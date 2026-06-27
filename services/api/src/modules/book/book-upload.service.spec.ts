import { normalizeUploadFilename } from "./upload-filename";
import { BookUploadService } from "./book-upload.service";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("normalizeUploadFilename", () => {
  it("keeps normal filenames unchanged", () => {
    expect(normalizeUploadFilename("我的小说.txt")).toBe("我的小说.txt");
    expect(normalizeUploadFilename("novel.txt")).toBe("novel.txt");
  });

  it("repairs latin1-decoded utf8 filenames", () => {
    const mojibake = Buffer.from("我的小说.txt", "utf8").toString("latin1");
    expect(normalizeUploadFilename(mojibake)).toBe("我的小说.txt");
  });

  it("removes browser supplied path segments", () => {
    expect(normalizeUploadFilename("C:\\fakepath\\我的小说.txt")).toBe(
      "我的小说.txt",
    );
  });
});

function makeConfigService(overrides?: Record<string, unknown>) {
  const store: Record<string, unknown> = { ...overrides };
  return {
    get: jest.fn((key: string) => store[key]),
  };
}

describe("BookUploadService", () => {
  it("rejects missing or empty TXT files with an actionable message", async () => {
    const service = new BookUploadService(
      {} as never,
      {} as never,
      makeConfigService() as never,
    );

    await expect(
      service.createUpload({
        title: "空文件",
        genre: "other",
        file: { originalname: "empty.txt", buffer: Buffer.alloc(0) },
      }),
    ).rejects.toThrow("请上传有正文内容的 TXT 文件");
  });

  it("stores upload artifacts as plaintext by default", async () => {
    const storageDir = await mkdtemp(join(tmpdir(), "book-upload-plain-"));

    try {
      const service = new BookUploadService(
        {
          createUpload: jest.fn().mockRejectedValue(new Error("db down")),
          getUpload: jest.fn().mockResolvedValue(undefined),
          listUploads: jest.fn().mockResolvedValue([]),
        } as never,
        {
          preprocess: jest.fn().mockReturnValue({
            chapters: [
              {
                id: "ch-1",
                order: 1,
                title: "第一章",
                text: "正文内容",
                splitBy: "heading",
                charCount: 4,
                wordCount: 4,
                startOffset: 0,
                endOffset: 4,
              },
            ],
            cleaning: {
              rawLength: 8,
              cleanedLength: 8,
              removedNoise: [],
              paragraphCount: 1,
            },
          }),
        } as never,
        makeConfigService({
          "analysis.storageDir": storageDir,
        }) as never,
      );

      const upload = await service.createUpload({
        title: "明文测试",
        genre: "other",
        file: {
          originalname: "plain.txt",
          buffer: Buffer.from("第一章\n正文内容"),
        },
      });

      expect(upload.rawTextPath.endsWith("raw.txt")).toBe(true);
      expect(await readFile(upload.rawTextPath, "utf8")).toContain("正文内容");
      expect(await service.readNormalizedText(upload.id)).toContain("正文内容");
    } finally {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it("encrypts upload artifacts when ANALYSIS_STORAGE_KEY is set", async () => {
    const storageDir = await mkdtemp(join(tmpdir(), "book-upload-encrypted-"));

    try {
      const service = new BookUploadService(
        {
          createUpload: jest.fn().mockRejectedValue(new Error("db down")),
          getUpload: jest.fn().mockResolvedValue(undefined),
          listUploads: jest.fn().mockResolvedValue([]),
        } as never,
        {
          preprocess: jest.fn().mockReturnValue({
            chapters: [
              {
                id: "ch-1",
                order: 1,
                title: "第一章",
                text: "需要保护的正文",
                splitBy: "heading",
                charCount: 7,
                wordCount: 7,
                startOffset: 0,
                endOffset: 7,
              },
            ],
            cleaning: {
              rawLength: 11,
              cleanedLength: 11,
              removedNoise: [],
              paragraphCount: 1,
            },
          }),
        } as never,
        makeConfigService({
          "analysis.storageDir": storageDir,
          "analysis.storageKey": "local privacy mode test key",
        }) as never,
      );

      const upload = await service.createUpload({
        title: "加密测试",
        genre: "other",
        file: {
          originalname: "encrypted.txt",
          buffer: Buffer.from("第一章\n需要保护的正文"),
        },
      });
      const files = await readdir(join(storageDir, "uploads", upload.id));

      expect(upload.rawTextPath.endsWith("raw.txt.enc")).toBe(true);
      expect(upload.normalizedTextPath.endsWith("normalized.txt.enc")).toBe(
        true,
      );
      expect(files).toEqual(
        expect.arrayContaining([
          "raw.txt.enc",
          "normalized.txt.enc",
          "snapshot.json.enc",
        ]),
      );
      expect(await readFile(upload.rawTextPath, "utf8")).not.toContain(
        "需要保护的正文",
      );
      expect(await service.readNormalizedText(upload.id)).toContain(
        "需要保护的正文",
      );
      expect((await service.getUpload(upload.id)).title).toBe("加密测试");
      expect((await service.listUploads(5))[0].id).toBe(upload.id);
    } finally {
      await rm(storageDir, { recursive: true, force: true });
    }
  });
});
