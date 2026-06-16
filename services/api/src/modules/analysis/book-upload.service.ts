import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  private readonly storageRoot =
    process.env.ANALYSIS_STORAGE_DIR?.trim() ||
    join(process.cwd(), ".local", "analysis");

  constructor(
    private readonly repository: AnalysisPersistenceRepository,
    private readonly textPreprocessor: TextPreprocessorService,
  ) {}

  async createUpload(
    input: CreateUploadInput,
  ): Promise<AnalysisUploadSnapshot> {
    if (!input.file?.buffer?.length) {
      throw new BadRequestException("TXT file is required.");
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

    const rawTextPath = join(uploadDir, "raw.txt");
    const normalizedTextPath = join(uploadDir, "normalized.txt");
    await Promise.all([
      writeFile(rawTextPath, rawText, "utf8"),
      writeFile(normalizedTextPath, normalizedText, "utf8"),
    ]);

    return this.repository.createUpload({
      title: input.title?.trim() || originalFilename.replace(/\.[^.]+$/, ""),
      genre: input.genre,
      originalFilename,
      rawTextPath,
      normalizedTextPath,
      rawLength: rawText.length,
      cleanedLength: preprocessing.cleaning.cleanedLength,
      chapterCount: preprocessing.chapters.length,
      preprocessing,
    });
  }

  async getUpload(uploadId: string): Promise<AnalysisUploadSnapshot> {
    const upload = await this.repository.getUpload(uploadId);
    if (!upload) {
      throw new NotFoundException(`Book upload not found: ${uploadId}`);
    }

    return upload;
  }

  async readNormalizedText(uploadId: string): Promise<string> {
    const upload = await this.getUpload(uploadId);
    return readFile(upload.normalizedTextPath, "utf8");
  }

  toPublicUpload(upload: AnalysisUploadSnapshot) {
    const {
      rawTextPath: _rawTextPath,
      normalizedTextPath: _normalizedTextPath,
      ...safe
    } = upload;
    return safe;
  }
}
