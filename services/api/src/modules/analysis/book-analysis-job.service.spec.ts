import { BookAnalysisJobService } from "./book-analysis-job.service";

describe("BookAnalysisJobService", () => {
  function createRepositoryMock(overrides?: Record<string, jest.Mock>) {
    return {
      deleteJob: jest.fn(async () => true),
      getJob: jest.fn(async () => ({
        id: "job-1",
        type: "book-map-reduce-analysis",
        status: "succeeded",
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
        inputSummary: {
          title: "测试书",
          genre: "other",
          textLength: 1200,
        },
        progress: {
          stage: "succeeded",
          current: 1,
          total: 1,
          message: "done",
        },
      })),
      markInterruptedJobsFailed: jest.fn(),
      ...overrides,
    };
  }

  it("omits heavy chapter map payloads from job snapshots", () => {
    const service = new BookAnalysisJobService({
      markInterruptedJobsFailed: jest.fn(),
    } as never);

    const snapshot = (
      service as unknown as {
        snapshot: (job: unknown) => {
          partialResult?: Record<string, unknown>;
        };
      }
    ).snapshot({
      id: "job-1",
      type: "book-map-reduce-analysis",
      status: "running",
      createdAt: "2026-06-20T00:00:00.000Z",
      updatedAt: "2026-06-20T00:00:00.000Z",
      inputSummary: {
        title: "测试书",
        genre: "other",
        textLength: 1200,
      },
      progress: {
        stage: "map",
        current: 3,
        total: 10,
        message: "processing",
      },
      partialResult: {
        partial: true,
        type: "book-map-reduce-partial",
        stage: "map",
        savedAt: "2026-06-20T00:00:00.000Z",
        mapCount: 3,
        totalChapters: 10,
        artifactDir: "tmp/job-1",
        chapterMaps: [{ chapterId: "ch-1" }],
        notice: "partial",
      },
    });

    expect(snapshot.partialResult).toEqual(
      expect.objectContaining({
        mapCount: 3,
        totalChapters: 10,
      }),
    );
    expect(snapshot.partialResult).not.toHaveProperty("chapterMaps");
  });

  it("deletes completed persisted jobs", async () => {
    const repository = createRepositoryMock();
    const service = new BookAnalysisJobService(repository as never);

    await expect(service.delete("job-1")).resolves.toEqual({
      deleted: true,
      jobId: "job-1",
    });
    expect(repository.deleteJob).toHaveBeenCalledWith("job-1");
  });

  it("rejects deletion while a job is still running", async () => {
    const repository = createRepositoryMock({
      getJob: jest.fn(async () => ({
        id: "job-1",
        type: "book-map-reduce-analysis",
        status: "running",
        createdAt: "2026-06-20T00:00:00.000Z",
        updatedAt: "2026-06-20T00:00:00.000Z",
        inputSummary: {
          title: "测试书",
          genre: "other",
          textLength: 1200,
        },
        progress: {
          stage: "map",
          current: 1,
          total: 10,
          message: "processing",
        },
      })),
    });
    const service = new BookAnalysisJobService(repository as never);

    await expect(service.delete("job-1")).rejects.toThrow(
      "Running book analysis jobs cannot be deleted.",
    );
    expect(repository.deleteJob).not.toHaveBeenCalled();
  });
});
