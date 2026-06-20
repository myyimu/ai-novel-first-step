import { Injectable } from "@nestjs/common";
import { desc, eq, inArray } from "drizzle-orm";
import { DrizzleService } from "@/service/drizzle/drizzle.service";
import {
  analysisUploads,
  bookAnalysisJobs,
  type AnalysisUploadSelect,
  type BookAnalysisJobSelect,
} from "@/service/drizzle/schema";
import {
  type BookAnalysisJobProgress,
  type BookAnalysisJobSnapshot,
  type BookAnalysisJobStatus,
} from "./book-analysis-job.service";
import { type BookPreprocessResult } from "./text-preprocessor.service";

export interface AnalysisUploadSnapshot {
  id: string;
  title: string;
  genre: string;
  originalFilename: string;
  rawTextPath: string;
  normalizedTextPath: string;
  rawLength: number;
  cleanedLength: number;
  chapterCount: number;
  preprocessing: BookPreprocessResult;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class AnalysisPersistenceRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async createUpload(input: {
    title: string;
    genre: string;
    originalFilename: string;
    rawTextPath: string;
    normalizedTextPath: string;
    rawLength: number;
    cleanedLength: number;
    chapterCount: number;
    preprocessing: BookPreprocessResult;
  }): Promise<AnalysisUploadSnapshot> {
    const [row] = await this.drizzle.db
      .insert(analysisUploads)
      .values({
        ...input,
        preprocessing: input.preprocessing,
        updated: new Date(),
      })
      .returning();

    return this.uploadSnapshot(row);
  }

  async getUpload(
    uploadId: string,
  ): Promise<AnalysisUploadSnapshot | undefined> {
    const [row] = await this.drizzle.db
      .select()
      .from(analysisUploads)
      .where(eq(analysisUploads.id, uploadId))
      .limit(1);

    return row ? this.uploadSnapshot(row) : undefined;
  }

  async listUploads(limit = 20): Promise<AnalysisUploadSnapshot[]> {
    const rows = await this.drizzle.db
      .select()
      .from(analysisUploads)
      .orderBy(desc(analysisUploads.created))
      .limit(Math.min(Math.max(limit, 1), 100));

    return rows.map((row) => this.uploadSnapshot(row));
  }

  async createJob(
    job: BookAnalysisJobSnapshot,
    uploadId?: string,
  ): Promise<BookAnalysisJobSnapshot> {
    const [row] = await this.drizzle.db
      .insert(bookAnalysisJobs)
      .values({
        id: job.id,
        uploadId,
        type: job.type,
        status: job.status,
        inputSummary: job.inputSummary,
        progress: job.progress,
        preprocessing: job.preprocessing,
        partialResult: job.partialResult,
        result: job.result,
        error: job.error,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
        startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
        finishedAt: job.finishedAt ? new Date(job.finishedAt) : undefined,
      })
      .returning();

    return this.jobSnapshot(row);
  }

  async getJob(
    jobId: string,
    options?: { includeResult?: boolean },
  ): Promise<BookAnalysisJobSnapshot | undefined> {
    const [row] = await this.drizzle.db
      .select()
      .from(bookAnalysisJobs)
      .where(eq(bookAnalysisJobs.id, jobId))
      .limit(1);

    return row ? this.jobSnapshot(row, options) : undefined;
  }

  async listJobs(limit = 20): Promise<BookAnalysisJobSnapshot[]> {
    const rows = await this.drizzle.db
      .select()
      .from(bookAnalysisJobs)
      .orderBy(desc(bookAnalysisJobs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));

    return rows.map((row) => this.jobSnapshot(row));
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const rows = await this.drizzle.db
      .delete(bookAnalysisJobs)
      .where(eq(bookAnalysisJobs.id, jobId))
      .returning({ id: bookAnalysisJobs.id });

    return rows.length > 0;
  }

  async updateJob(
    jobId: string,
    patch: Partial<{
      status: BookAnalysisJobStatus;
      progress: BookAnalysisJobProgress;
      preprocessing: BookAnalysisJobSnapshot["preprocessing"];
      partialResult: BookAnalysisJobSnapshot["partialResult"];
      result: unknown;
      error: string | null;
      startedAt: string | null;
      finishedAt: string | null;
    }>,
  ): Promise<BookAnalysisJobSnapshot | undefined> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (patch.status !== undefined) values.status = patch.status;
    if (patch.progress !== undefined) values.progress = patch.progress;
    if (patch.preprocessing !== undefined)
      values.preprocessing = patch.preprocessing;
    if (patch.partialResult !== undefined)
      values.partialResult = patch.partialResult;
    if (patch.result !== undefined) values.result = patch.result;
    if (patch.error !== undefined) values.error = patch.error;
    if (patch.startedAt !== undefined) {
      values.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    }
    if (patch.finishedAt !== undefined) {
      values.finishedAt = patch.finishedAt ? new Date(patch.finishedAt) : null;
    }

    const [row] = await this.drizzle.db
      .update(bookAnalysisJobs)
      .set(values)
      .where(eq(bookAnalysisJobs.id, jobId))
      .returning();

    return row ? this.jobSnapshot(row) : undefined;
  }

  async markInterruptedJobsFailed() {
    const now = new Date();
    await this.drizzle.db
      .update(bookAnalysisJobs)
      .set({
        status: "failed",
        error:
          "服务重启后无法继续未完成任务。请重新提交，用户模型 Key 不会持久化保存。",
        progress: {
          stage: "failed",
          current: 0,
          total: 1,
          message: "服务重启后任务已中断，请重新提交。",
        },
        updatedAt: now,
        finishedAt: now,
      })
      .where(inArray(bookAnalysisJobs.status, ["queued", "running"]));
  }

  private uploadSnapshot(row: AnalysisUploadSelect): AnalysisUploadSnapshot {
    return {
      id: row.id,
      title: row.title,
      genre: row.genre,
      originalFilename: row.originalFilename,
      rawTextPath: row.rawTextPath,
      normalizedTextPath: row.normalizedTextPath,
      rawLength: row.rawLength,
      cleanedLength: row.cleanedLength,
      chapterCount: row.chapterCount,
      preprocessing: row.preprocessing as BookPreprocessResult,
      createdAt: row.created.toISOString(),
      updatedAt: row.updated.toISOString(),
    };
  }

  private jobSnapshot(
    row: BookAnalysisJobSelect,
    options?: { includeResult?: boolean },
  ): BookAnalysisJobSnapshot {
    const partialResult = row.partialResult as
      | (BookAnalysisJobSnapshot["partialResult"] & { chapterMaps?: unknown[] })
      | undefined;

    return {
      id: row.id,
      type: "book-map-reduce-analysis",
      status: row.status as BookAnalysisJobStatus,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      startedAt: row.startedAt?.toISOString(),
      finishedAt: row.finishedAt?.toISOString(),
      inputSummary: row.inputSummary as BookAnalysisJobSnapshot["inputSummary"],
      progress: row.progress as BookAnalysisJobProgress,
      preprocessing:
        row.preprocessing as BookAnalysisJobSnapshot["preprocessing"],
      partialResult: partialResult
        ? {
            partial: partialResult.partial,
            type: partialResult.type,
            stage: partialResult.stage,
            savedAt: partialResult.savedAt,
            mapCount: partialResult.mapCount,
            totalChapters: partialResult.totalChapters,
            artifactDir: partialResult.artifactDir,
            notice: partialResult.notice,
            analysisStrategy: partialResult.analysisStrategy,
            outlineCount: partialResult.outlineCount,
            deepTargetOrders: partialResult.deepTargetOrders,
            deepCompletedCount: partialResult.deepCompletedCount,
          }
        : undefined,
      result: options?.includeResult === false ? undefined : row.result,
      error: row.error ?? undefined,
      uploadId: row.uploadId ?? undefined,
    };
  }
}
