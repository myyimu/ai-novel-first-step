import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";

describe("AnalysisPersistenceRepository", () => {
  it("reads back an upload after inserting with a stable id", async () => {
    const created = new Date(2026, 0, 1, 0, 0, 0);
    const updated = new Date(2026, 0, 1, 0, 1, 0);
    const row = {
      id: "upload-1",
      title: "测试书",
      genre: "other",
      original_filename: "book.txt",
      raw_text_path: "raw.txt",
      normalized_text_path: "normalized.txt",
      raw_length: 100,
      cleaned_length: 90,
      chapter_count: 2,
      preprocessing: { chapters: [], cleaning: { cleanedLength: 90 } },
      created,
      updated,
    };
    const queryRows = jest.fn().mockResolvedValue([row]);
    const repository = new AnalysisPersistenceRepository({
      queryRows,
    } as never);

    const upload = await repository.createUpload({
      id: "upload-1",
      title: "测试书",
      genre: "other",
      originalFilename: "book.txt",
      rawTextPath: "raw.txt",
      normalizedTextPath: "normalized.txt",
      rawLength: 100,
      cleanedLength: 90,
      chapterCount: 2,
      preprocessing: row.preprocessing as never,
    });

    expect(queryRows).toHaveBeenCalledTimes(1);
    expect(upload).toEqual(
      expect.objectContaining({
        id: "upload-1",
        title: "测试书",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:01:00.000Z",
      }),
    );
  });

  it("reads back a job after inserting with a stable id", async () => {
    const createdAt = new Date(2026, 0, 1, 0, 0, 0);
    const updatedAt = new Date(2026, 0, 1, 0, 1, 0);
    const row = {
      id: "job-1",
      upload_id: "upload-1",
      type: "book-map-reduce-analysis",
      status: "queued",
      input_summary: { title: "测试书", genre: "other", textLength: 100 },
      progress: { stage: "queued", current: 0, total: 1, message: "queued" },
      preprocessing: undefined,
      partial_result: undefined,
      result: undefined,
      error: null,
      created_at: createdAt,
      updated_at: updatedAt,
      started_at: null,
      finished_at: null,
    };
    const queryRows = jest.fn().mockResolvedValue([row]);
    const repository = new AnalysisPersistenceRepository({
      queryRows,
    } as never);

    const job = await repository.createJob(
      {
        id: "job-1",
        uploadId: "upload-1",
        type: "book-map-reduce-analysis",
        status: "queued",
        inputSummary: { title: "测试书", genre: "other", textLength: 100 },
        progress: {
          stage: "queued",
          current: 0,
          total: 1,
          message: "queued",
        },
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      } as never,
      "upload-1",
    );

    expect(queryRows).toHaveBeenCalledTimes(1);
    expect(job).toEqual(
      expect.objectContaining({
        id: "job-1",
        uploadId: "upload-1",
        status: "queued",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:01:00.000Z",
      }),
    );
  });
});
