import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { type Response } from "express";
import { Public } from "@/core/decorators/public.decorators";
import { AnalysisService } from "./analysis.service";
import {
  type BookExportFormat,
  type BookExportMode,
} from "./book-export.service";
import { AnalyzeBookDto } from "./dto/analyze-book.dto";
import { AskResearchLibraryDto } from "./dto/ask-research-library.dto";
import { BuildRubricDto } from "./dto/build-rubric.dto";
import { CompareResearchBooksDto } from "./dto/compare-research-books.dto";
import { CreateBookJobFromUploadDto } from "./dto/create-book-job-from-upload.dto";
import { InferReferenceProfileDto } from "./dto/infer-reference-profile.dto";
import { PreprocessBookDto } from "./dto/preprocess-book.dto";
import { PreviewAnalysisDto } from "./dto/preview-analysis.dto";
import { QuickReviewDto } from "./dto/quick-review.dto";
import { ScoreChapterDto } from "./dto/score-chapter.dto";
import { TestProviderDto } from "./dto/provider-config.dto";
import { ResearchLibraryService } from "./research-library.service";

@ApiTags("analysis")
@Controller("analysis")
export class AnalysisController {
  constructor(
    private readonly analysisService: AnalysisService,
    private readonly researchLibrary: ResearchLibraryService,
  ) {}

  @Get("pipeline")
  @Public()
  @ApiOperation({ summary: "Read the planned AI critique pipeline" })
  getPipeline() {
    return this.analysisService.getPipeline();
  }

  @Post("preview")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Preview chapter scoring without a real LLM provider",
  })
  @ApiResponse({ status: 200, description: "Structured preview score" })
  preview(@Body() body: PreviewAnalysisDto) {
    return this.analysisService.previewScore(body);
  }

  @Post("quick-review")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Quick single-pass chapter review for first-time users",
  })
  @ApiResponse({ status: 200, description: "Structured quick review" })
  quickReview(@Body() body: QuickReviewDto) {
    return this.analysisService.quickReview(body);
  }

  @Post("provider/test")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Test a user supplied model provider" })
  testProvider(@Body() body: TestProviderDto) {
    return this.analysisService.testProvider(body.provider);
  }

  @Get("provider/presets")
  @Public()
  @ApiOperation({ summary: "List provider presets for BYOK model setup" })
  getProviderPresets() {
    return this.analysisService.getProviderPresets();
  }

  @Post("reference/profile")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Infer market positioning from a reference chapter",
  })
  @ApiResponse({
    status: 200,
    description: "AI inferred chapter title, genre and market profile",
  })
  inferReferenceProfile(@Body() body: InferReferenceProfileDto) {
    return this.analysisService.inferReferenceProfile(body);
  }

  @Post("rubric")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Build a critique rubric from a reference chapter" })
  @ApiResponse({
    status: 200,
    description: "Reference analysis and generated rubric",
  })
  buildRubric(@Body() body: BuildRubricDto) {
    return this.analysisService.buildRubric(body);
  }

  @Post("score")
  @HttpCode(200)
  @Public()
  @ApiOperation({ summary: "Score a user chapter with a generated rubric" })
  @ApiResponse({ status: 200, description: "Structured chapter score report" })
  scoreChapter(@Body() body: ScoreChapterDto) {
    return this.analysisService.scoreChapter(body);
  }

  @Post("book")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Synchronously analyze a full novel text with map-reduce",
  })
  @ApiResponse({
    status: 200,
    description: "Book-level asset extraction report",
  })
  analyzeBook(@Body() body: AnalyzeBookDto): Promise<unknown> {
    return this.analysisService.analyzeBook(body);
  }

  @Post("book/preprocess")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Clean TXT content and split it into chapter segments",
  })
  preprocessBook(@Body() body: PreprocessBookDto) {
    return this.analysisService.preprocessBook(body);
  }

  @Post("book/jobs")
  @HttpCode(202)
  @Public()
  @ApiOperation({ summary: "Create an async book map-reduce analysis job" })
  createBookAnalysisJob(@Body() body: AnalyzeBookDto) {
    return this.analysisService.createBookAnalysisJob(body);
  }

  @Post("book/jobs/:jobId/resume")
  @HttpCode(202)
  @Public()
  @ApiOperation({
    summary: "Resume a failed async book analysis job from saved chapter maps",
  })
  resumeBookAnalysisJob(
    @Param("jobId") jobId: string,
    @Body() body: CreateBookJobFromUploadDto,
  ) {
    return this.analysisService.resumeBookAnalysisJob({
      jobId,
      provider: body.provider,
    });
  }

  @Get("book/jobs/:jobId")
  @Public()
  @ApiOperation({ summary: "Read async book analysis job status" })
  getBookAnalysisJob(
    @Param("jobId") jobId: string,
    @Query("includeResult") includeResult?: string,
  ) {
    return this.analysisService.getBookAnalysisJob(jobId, {
      includeResult: includeResult !== "false",
    });
  }

  @Delete("book/jobs/:jobId")
  @Public()
  @ApiOperation({ summary: "Delete a completed or failed book analysis job" })
  deleteBookAnalysisJob(@Param("jobId") jobId: string) {
    return this.analysisService.deleteBookAnalysisJob(jobId);
  }

  @Get("book/jobs/:jobId/search")
  @Public()
  @ApiOperation({
    summary: "Search chunk-level evidence anchors inside a succeeded book job",
  })
  searchBookAnalysisEvidence(
    @Param("jobId") jobId: string,
    @Query("q") query?: string,
    @Query("limit") limit?: string,
  ) {
    return this.analysisService.searchBookAnalysisEvidence(
      jobId,
      query || "",
      limit ? Number(limit) : undefined,
    );
  }

  @Get("book/jobs")
  @Public()
  @ApiOperation({ summary: "List recent book analysis jobs" })
  listBookAnalysisJobs(@Query("limit") limit?: string) {
    return this.analysisService.listBookAnalysisJobs(
      limit ? Number(limit) : undefined,
    );
  }

  @Get("book/jobs/:jobId/export")
  @Public()
  @ApiOperation({ summary: "Export a succeeded book analysis job" })
  async exportBookAnalysisJob(
    @Param("jobId") jobId: string,
    @Query("format") format: BookExportFormat = "markdown",
    @Query("mode") mode: BookExportMode = "notes",
    @Res() response: Response,
  ) {
    const exported = await this.analysisService.exportBookAnalysisJob(
      jobId,
      format,
      mode,
    );
    response.setHeader("content-type", exported.contentType);
    response.setHeader(
      "content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
    );
    response.send(exported.content);
  }

  @Post("book/uploads")
  @HttpCode(201)
  @Public()
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file", "genre"],
      properties: {
        file: { type: "string", format: "binary" },
        title: { type: "string" },
        genre: { type: "string", example: "xuanhuan" },
      },
    },
  })
  @ApiOperation({ summary: "Upload a TXT novel and preview chapter splitting" })
  uploadBook(
    @UploadedFile() file: { originalname?: string; buffer?: Buffer },
    @Body() body: { title?: string; genre?: string },
  ) {
    return this.analysisService.uploadBookFile({
      title: body.title,
      genre: body.genre || "other",
      file,
    });
  }

  @Get("book/uploads/:uploadId")
  @Public()
  @ApiOperation({
    summary: "Read uploaded TXT preprocessing and chapter preview",
  })
  getBookUpload(@Param("uploadId") uploadId: string) {
    return this.analysisService.getBookUpload(uploadId);
  }

  @Get("book/uploads")
  @Public()
  @ApiOperation({ summary: "List recent uploaded TXT files" })
  listBookUploads(@Query("limit") limit?: string) {
    return this.analysisService.listBookUploads(
      limit ? Number(limit) : undefined,
    );
  }

  @Get("research/library")
  @Public()
  @ApiOperation({
    summary: "Read persisted research-library assets derived from book jobs",
  })
  getResearchLibrary(@Query("limit") limit?: string) {
    return this.researchLibrary.getLibrary(limit ? Number(limit) : undefined);
  }

  @Post("research/compare")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Compare multiple succeeded book-analysis jobs",
  })
  compareResearchBooks(
    @Body() body: CompareResearchBooksDto,
  ): Promise<unknown> {
    return this.researchLibrary.compareBooks(body);
  }

  @Post("research/ask")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Answer a question from persisted research-library assets",
  })
  askResearchLibrary(@Body() body: AskResearchLibraryDto): Promise<unknown> {
    return this.researchLibrary.answerQuestion(body);
  }

  @Post("book/uploads/:uploadId/jobs")
  @HttpCode(202)
  @Public()
  @ApiOperation({
    summary: "Create an async map-reduce job from an uploaded TXT",
  })
  createBookAnalysisJobFromUpload(
    @Param("uploadId") uploadId: string,
    @Body() body: CreateBookJobFromUploadDto,
  ) {
    return this.analysisService.createBookAnalysisJobFromUpload({
      uploadId,
      provider: body.provider,
    });
  }
}
