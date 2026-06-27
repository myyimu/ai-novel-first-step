import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AnalysisPersistenceRepository,
  type AnalysisUploadSnapshot,
} from "./analysis-persistence.repository";
import { TextPreprocessorService } from "./text-preprocessor.service";
import { normalizeUploadFilename } from "./upload-filename";

export interface UploadedTxtFile {
  originalname?: string;
  buffer?: Buffer;
  mimetype?: string;
  size?: number;
}

export interface CreateUploadInput {
  title?: string;
  genre: string;
  file: UploadedTxtFile;
}

@Injectable()
export class BookUploadService {
  private readonly logger = new Logger(BookUploadService.name);
  private readonly storageRoot: string;
  private readonly encryptionKey: Buffer | undefined;

  constructor(
    private readonly repository: AnalysisPersistenceRepository,
    private readonly textPreprocessor: TextPreprocessorService,
    configService: ConfigService,
  ) {
    this.storageRoot =
      configService.get<string>("analysis.storageDir") ||
      join(process.cwd(), ".local", "analysis");
    const storageKey = configService.get<string>("analysis.storageKey");
    this.encryptionKey = storageKey
      ? createHash("sha256").update(storageKey).digest()
      : undefined;
  }

  async createUpload(
    input: CreateUploadInput,
  ): Promise<AnalysisUploadSnapshot> {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException(
        "请上传有正文内容的 TXT 文件，或在页面文本框粘贴整书内容后再预览章节。",
      );
    }

    const originalFilename = normalizeUploadFilename(input.file.originalname);
    if (!originalFilename.toLowerCase().endsWith(".txt")) {
      throw new BadRequestException("Only .txt files are supported.");
    }

    const rawText = input.file.buffer.toString("utf8");
    const preprocessing = this.textPreprocessor.preprocess(rawText);
    const normalizedText = preprocessing.chapters
      .map((chapter) => `${chapter.title}\n${chapter.text}`)
      .join("\n\n");
    const uploadId = randomUUID();
    const uploadDir = join(this.storageRoot, "uploads", uploadId);
    await mkdir(uploadDir, { recursive: true });

    const [rawTextPath, normalizedTextPath] = await Promise.all([
      this.writeStoredText(join(uploadDir, "raw.txt"), rawText),
      this.writeStoredText(join(uploadDir, "normalized.txt"), normalizedText),
    ]);

    const snapshot: AnalysisUploadSnapshot = {
      id: uploadId,
      title: input.title?.trim() || originalFilename.replace(/\.[^.]+$/, ""),
      genre: input.genre,
      originalFilename,
      rawTextPath,
      normalizedTextPath,
      rawLength: rawText.length,
      cleanedLength: preprocessing.cleaning.cleanedLength,
      chapterCount: preprocessing.chapters.length,
      preprocessing,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.writeSnapshot(snapshot);

    try {
      const persisted = await this.repository.createUpload({
        id: uploadId,
        title: snapshot.title,
        genre: snapshot.genre,
        originalFilename: snapshot.originalFilename,
        rawTextPath: snapshot.rawTextPath,
        normalizedTextPath: snapshot.normalizedTextPath,
        rawLength: snapshot.rawLength,
        cleanedLength: snapshot.cleanedLength,
        chapterCount: snapshot.chapterCount,
        preprocessing: snapshot.preprocessing,
      });
      await this.writeSnapshot(persisted);
      return persisted;
    } catch (error) {
      this.logger.warn(
        `Upload ${uploadId} saved to local snapshot because database persistence failed: ${
          (error as Error).message
        }`,
      );
      return snapshot;
    }
  }

  async getUpload(uploadId: string): Promise<AnalysisUploadSnapshot> {
    const upload =
      (await this.repository.getUpload(uploadId)) ??
      (await this.readSnapshot(uploadId));
    if (!upload) {
      throw new NotFoundException(`Book upload not found: ${uploadId}`);
    }

    return upload;
  }

  async listUploads(limit = 20): Promise<AnalysisUploadSnapshot[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const byId = new Map<string, AnalysisUploadSnapshot>();

    try {
      for (const upload of await this.repository.listUploads(safeLimit)) {
        byId.set(upload.id, upload);
      }
    } catch (error) {
      this.logger.warn(
        `Listing database uploads failed; falling back to local snapshots: ${
          (error as Error).message
        }`,
      );
    }
    for (const upload of await this.listSnapshotUploads()) {
      if (!byId.has(upload.id)) {
        byId.set(upload.id, upload);
      }
    }

    return [...byId.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, safeLimit);
  }

  async readNormalizedText(uploadId: string): Promise<string> {
    const upload = await this.getUpload(uploadId);
    return this.readStoredText(upload.normalizedTextPath);
  }

  toPublicUpload(upload: AnalysisUploadSnapshot) {
    const {
      rawTextPath: _rawTextPath,
      normalizedTextPath: _normalizedTextPath,
      ...safe
    } = upload;
    return safe;
  }

  private snapshotPath(uploadId: string): string {
    return join(this.storageRoot, "uploads", uploadId, "snapshot.json");
  }

  private async writeSnapshot(upload: AnalysisUploadSnapshot): Promise<void> {
    await this.writeStoredText(
      this.snapshotPath(upload.id),
      JSON.stringify(upload),
    );
  }

  private async readSnapshot(
    uploadId: string,
  ): Promise<AnalysisUploadSnapshot | undefined> {
    for (const path of this.storageReadCandidates(
      this.snapshotPath(uploadId),
    )) {
      try {
        return JSON.parse(
          await this.readStoredText(path),
        ) as AnalysisUploadSnapshot;
      } catch {
        /* try next storage representation */
      }
    }
    return undefined;
  }

  private async listSnapshotUploads(): Promise<AnalysisUploadSnapshot[]> {
    const uploadsDir = join(this.storageRoot, "uploads");
    try {
      const entries = await readdir(uploadsDir, { withFileTypes: true });
      const snapshots = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => this.readSnapshot(entry.name)),
      );
      return snapshots.filter((upload): upload is AnalysisUploadSnapshot =>
        Boolean(upload),
      );
    } catch {
      return [];
    }
  }

  private async writeStoredText(path: string, text: string): Promise<string> {
    if (!this.encryptionKey) {
      await writeFile(path, text, "utf8");
      return path;
    }

    const encryptedPath = this.encryptedPath(path);
    await writeFile(
      encryptedPath,
      this.encryptBuffer(Buffer.from(text, "utf8")),
    );
    return encryptedPath;
  }

  private async readStoredText(path: string): Promise<string> {
    if (path.endsWith(".enc")) {
      return this.decryptBuffer(await readFile(path)).toString("utf8");
    }
    return readFile(path, "utf8");
  }

  private storageReadCandidates(path: string): string[] {
    return path.endsWith(".enc") ? [path] : [path, this.encryptedPath(path)];
  }

  private encryptedPath(path: string): string {
    return path.endsWith(".enc") ? path : `${path}.enc`;
  }

  private encryptBuffer(plain: Buffer): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey!, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    return Buffer.concat([
      Buffer.from("ANDENC1"),
      iv,
      cipher.getAuthTag(),
      encrypted,
    ]);
  }

  private decryptBuffer(payload: Buffer): Buffer {
    const magic = payload.subarray(0, 7).toString("utf8");
    if (magic !== "ANDENC1") {
      throw new Error("Unsupported encrypted analysis upload format.");
    }
    if (!this.encryptionKey) {
      throw new Error(
        "ANALYSIS_STORAGE_KEY is required to read encrypted uploads.",
      );
    }

    const iv = payload.subarray(7, 19);
    const authTag = payload.subarray(19, 35);
    const encrypted = payload.subarray(35);
    const decipher = createDecipheriv("aes-256-gcm", this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}
