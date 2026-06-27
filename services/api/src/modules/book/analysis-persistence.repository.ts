import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DrizzleService } from "@/service/drizzle/drizzle.service";
import { type BookAnalysisJobSelect } from "@/service/drizzle/schema";
import {
  type BookAnalysisJobProgress,
  type BookAnalysisJobSnapshot,
  type BookAnalysisJobStatus,
} from "./book-analysis-job.service";
import { type BookPreprocessResult } from "./text-preprocessor.service";

interface AnalysisUploadRow {
  id: string;
  title: string;
  genre: string;
  original_filename: string;
  raw_text_path: string;
  normalized_text_path: string;
  raw_length: number;
  cleaned_length: number;
  chapter_count: number;
  preprocessing: unknown;
  created: Date | string;
  updated: Date | string;
}

interface BookAnalysisJobRow {
  id: string;
  upload_id: string | null;
  type: string;
  status: string;
  input_summary: unknown;
  progress: unknown;
  preprocessing: unknown;
  partial_result: unknown;
  result: unknown;
  error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  started_at: Date | string | null;
  finished_at: Date | string | null;
}

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
    id?: string;
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
    const id = input.id || randomUUID();
    const now = new Date();
    const timestamp = this.toDatabaseTimestamp(now);
    const row =
      (
        await this.drizzle.queryRows<AnalysisUploadRow>(
          `
      INSERT INTO "analysis_uploads" (
        "id",
        "title",
        "genre",
        "original_filename",
        "raw_text_path",
        "normalized_text_path",
        "raw_length",
        "cleaned_length",
        "chapter_count",
        "preprocessing",
        "created",
        "updated"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11,
        $12
      )
      RETURNING
        "id",
        "title",
        "genre",
        "original_filename",
        "raw_text_path",
        "normalized_text_path",
        "raw_length",
        "cleaned_length",
        "chapter_count",
        "preprocessing",
        "created",
        "updated"
    `,
          [
            id,
            input.title,
            input.genre,
            input.originalFilename,
            input.rawTextPath,
            input.normalizedTextPath,
            input.rawLength,
            input.cleanedLength,
            input.chapterCount,
            JSON.stringify(input.preprocessing),
            timestamp,
            timestamp,
          ],
        )
      )[0] ?? (await this.selectUploadRow(id));

    if (!row) {
      throw new Error(
        `Analysis upload insert did not return or persist row: ${id}`,
      );
    }
    return this.uploadSnapshot(row);
  }

  async getUpload(
    uploadId: string,
  ): Promise<AnalysisUploadSnapshot | undefined> {
    const row = await this.selectUploadRow(uploadId);

    return row ? this.uploadSnapshot(row) : undefined;
  }

  private async selectUploadRow(
    uploadId: string,
  ): Promise<AnalysisUploadRow | undefined> {
    return (
      await this.drizzle.queryRows<AnalysisUploadRow>(
        `
      SELECT
        "id",
        "title",
        "genre",
        "original_filename",
        "raw_text_path",
        "normalized_text_path",
        "raw_length",
        "cleaned_length",
        "chapter_count",
        "preprocessing",
        "created",
        "updated"
      FROM "analysis_uploads"
      WHERE "id" = $1
      LIMIT 1
    `,
        [uploadId],
      )
    )[0];
  }

  async listUploads(limit = 20): Promise<AnalysisUploadSnapshot[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.drizzle.queryRows<AnalysisUploadRow>(
      `
      SELECT
        "id",
        "title",
        "genre",
        "original_filename",
        "raw_text_path",
        "normalized_text_path",
        "raw_length",
        "cleaned_length",
        "chapter_count",
        "preprocessing",
        "created",
        "updated"
      FROM "analysis_uploads"
      ORDER BY "created" DESC
      LIMIT $1
    `,
      [safeLimit],
    );

    return rows.map((row) => this.uploadSnapshot(row));
  }

  async createJob(
    job: BookAnalysisJobSnapshot,
    uploadId?: string,
  ): Promise<BookAnalysisJobSnapshot> {
    const row =
      (
        await this.drizzle.queryRows<BookAnalysisJobRow>(
          `
      INSERT INTO "book_analysis_jobs" (
        "id",
        "upload_id",
        "type",
        "status",
        "input_summary",
        "progress",
        "preprocessing",
        "partial_result",
        "result",
        "error",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5::jsonb,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        $9::jsonb,
        $10,
        $11,
        $12,
        $13,
        $14
      )
      RETURNING
        "id",
        "upload_id",
        "type",
        "status",
        "input_summary",
        "progress",
        "preprocessing",
        "partial_result",
        "result",
        "error",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at"
    `,
          [
            job.id,
            uploadId ?? null,
            job.type,
            job.status,
            JSON.stringify(job.inputSummary),
            JSON.stringify(job.progress),
            this.jsonString(job.preprocessing),
            this.jsonString(job.partialResult),
            this.jsonString(job.result),
            job.error ?? null,
            this.toDatabaseTimestamp(job.createdAt),
            this.toDatabaseTimestamp(job.updatedAt),
            job.startedAt ? this.toDatabaseTimestamp(job.startedAt) : null,
            job.finishedAt ? this.toDatabaseTimestamp(job.finishedAt) : null,
          ],
        )
      )[0] ?? (await this.selectJobRow(job.id));

    if (!row) {
      throw new Error(
        `Book analysis job insert did not return or persist row: ${job.id}`,
      );
    }
    return this.jobSnapshotFromRaw(row);
  }

  async getJob(
    jobId: string,
    options?: { includeResult?: boolean },
  ): Promise<BookAnalysisJobSnapshot | undefined> {
    const row = await this.selectJobRow(jobId);

    return row ? this.jobSnapshotFromRaw(row, options) : undefined;
  }

  private async selectJobRow(
    jobId: string,
  ): Promise<BookAnalysisJobRow | undefined> {
    return (
      await this.drizzle.queryRows<BookAnalysisJobRow>(
        `
      SELECT
        "id",
        "upload_id",
        "type",
        "status",
        "input_summary",
        "progress",
        "preprocessing",
        "partial_result",
        "result",
        "error",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at"
      FROM "book_analysis_jobs"
      WHERE "id" = $1
      LIMIT 1
    `,
        [jobId],
      )
    )[0];
  }

  async listJobs(limit = 20): Promise<BookAnalysisJobSnapshot[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const rows = await this.drizzle.queryRows<BookAnalysisJobRow>(
      `
      SELECT
        "id",
        "upload_id",
        "type",
        "status",
        "input_summary",
        "progress",
        "preprocessing",
        "partial_result",
        "result",
        "error",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at"
      FROM "book_analysis_jobs"
      ORDER BY "created_at" DESC
      LIMIT $1
    `,
      [safeLimit],
    );

    return rows.map((row) => this.jobSnapshotFromRaw(row));
  }

  async deleteJob(jobId: string): Promise<boolean> {
    const rows = await this.drizzle.queryRows<{ id: string }>(
      `
      DELETE FROM "book_analysis_jobs"
      WHERE "id" = $1
      RETURNING "id"
    `,
      [jobId],
    );

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
    const params: unknown[] = [this.toDatabaseTimestamp(new Date())];
    const values: string[] = ['"updated_at" = $1'];

    const addValue = (column: string, value: unknown, cast = "") => {
      params.push(value);
      values.push(`"${column}" = $${params.length}${cast}`);
    };

    if (patch.status !== undefined) addValue("status", patch.status);
    if (patch.progress !== undefined)
      addValue("progress", this.jsonString(patch.progress), "::jsonb");
    if (patch.preprocessing !== undefined) {
      addValue(
        "preprocessing",
        this.jsonString(patch.preprocessing),
        "::jsonb",
      );
    }
    if (patch.partialResult !== undefined) {
      addValue(
        "partial_result",
        this.jsonString(patch.partialResult),
        "::jsonb",
      );
    }
    if (patch.result !== undefined) {
      addValue("result", this.jsonString(patch.result), "::jsonb");
    }
    if (patch.error !== undefined) addValue("error", patch.error);
    if (patch.startedAt !== undefined) {
      addValue(
        "started_at",
        patch.startedAt ? this.toDatabaseTimestamp(patch.startedAt) : null,
      );
    }
    if (patch.finishedAt !== undefined) {
      addValue(
        "finished_at",
        patch.finishedAt ? this.toDatabaseTimestamp(patch.finishedAt) : null,
      );
    }

    params.push(jobId);
    const row = (
      await this.drizzle.queryRows<BookAnalysisJobRow>(
        `
      UPDATE "book_analysis_jobs"
      SET ${values.join(", ")}
      WHERE "id" = $${params.length}
      RETURNING
        "id",
        "upload_id",
        "type",
        "status",
        "input_summary",
        "progress",
        "preprocessing",
        "partial_result",
        "result",
        "error",
        "created_at",
        "updated_at",
        "started_at",
        "finished_at"
    `,
        params,
      )
    )[0];

    return row ? this.jobSnapshotFromRaw(row) : undefined;
  }

  async markInterruptedJobsFailed() {
    const now = new Date();
    const timestamp = this.toDatabaseTimestamp(now);
    await this.drizzle.queryRows(
      `
      UPDATE "book_analysis_jobs"
      SET
        "status" = 'failed',
        "error" = $1,
        "progress" = $2::jsonb,
        "updated_at" = $3,
        "finished_at" = $4
      WHERE "status" IN ('queued', 'running')
    `,
      [
        "服务重启后无法继续未完成任务。请重新提交，用户模型 Key 不会持久化保存。",
        JSON.stringify({
          stage: "failed",
          current: 0,
          total: 1,
          message: "服务重启后任务已中断，请重新提交。",
        }),
        timestamp,
        timestamp,
      ],
    );
  }

  private uploadSnapshot(row: AnalysisUploadRow): AnalysisUploadSnapshot {
    return {
      id: row.id,
      title: row.title,
      genre: row.genre,
      originalFilename: row.original_filename,
      rawTextPath: row.raw_text_path,
      normalizedTextPath: row.normalized_text_path,
      rawLength: Number(row.raw_length),
      cleanedLength: Number(row.cleaned_length),
      chapterCount: Number(row.chapter_count),
      preprocessing: this.jsonValue(row.preprocessing) as BookPreprocessResult,
      createdAt: this.toIsoString(row.created),
      updatedAt: this.toIsoString(row.updated),
    };
  }

  private jobSnapshotFromRaw(
    row: BookAnalysisJobRow,
    options?: { includeResult?: boolean },
  ): BookAnalysisJobSnapshot {
    return this.jobSnapshot(
      {
        id: row.id,
        uploadId: row.upload_id,
        type: row.type,
        status: row.status,
        inputSummary: this.jsonValue(row.input_summary),
        progress: this.jsonValue(row.progress),
        preprocessing: this.jsonValue(row.preprocessing),
        partialResult: this.jsonValue(row.partial_result),
        result: this.jsonValue(row.result),
        error: row.error,
        createdAt: new Date(this.toIsoString(row.created_at)),
        updatedAt: new Date(this.toIsoString(row.updated_at)),
        startedAt: row.started_at
          ? new Date(this.toIsoString(row.started_at))
          : null,
        finishedAt: row.finished_at
          ? new Date(this.toIsoString(row.finished_at))
          : null,
      } as BookAnalysisJobSelect,
      options,
    );
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

  private jsonString(value: unknown): string | null {
    return value === undefined ? null : JSON.stringify(value);
  }

  private toDatabaseTimestamp(value: Date | string): string {
    return (value instanceof Date ? value : new Date(value))
      .toISOString()
      .replace("T", " ")
      .replace("Z", "");
  }

  private jsonValue(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  private toIsoString(value: Date | string): string {
    if (value instanceof Date) {
      return new Date(
        Date.UTC(
          value.getFullYear(),
          value.getMonth(),
          value.getDate(),
          value.getHours(),
          value.getMinutes(),
          value.getSeconds(),
          value.getMilliseconds(),
        ),
      ).toISOString();
    }
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
      ? `${value.replace(" ", "T")}Z`
      : value;
    return new Date(normalized).toISOString();
  }
}
