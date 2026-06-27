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
import { AnalyzeBookDto } from "@/modules/analysis/dto/analyze-book.dto";
import { CreateBookJobFromUploadDto } from "@/modules/analysis/dto/create-book-job-from-upload.dto";
import { PreprocessBookDto } from "@/modules/analysis/dto/preprocess-book.dto";
import { BookAnalysisService } from "./book-analysis.service";
import {
  type BookExportFormat,
  type BookExportMode,
} from "./book-export.service";

@ApiTags("analysis")
@Controller("analysis")
export class BookController {
  constructor(private readonly bookAnalysis: BookAnalysisService) {}

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
    return this.bookAnalysis.analyzeBook(body);
  }

  @Post("book/preprocess")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Clean TXT content and split it into chapter segments",
  })
  preprocessBook(@Body() body: PreprocessBookDto) {
    return this.bookAnalysis.preprocessBook(body);
  }

  @Post("book/jobs")
  @HttpCode(202)
  @Public()
  @ApiOperation({ summary: "Create an async book map-reduce analysis job" })
  createBookAnalysisJob(@Body() body: AnalyzeBookDto) {
    return this.bookAnalysis.createBookAnalysisJob(body);
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
    return this.bookAnalysis.resumeBookAnalysisJob({
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
    return this.bookAnalysis.getBookAnalysisJob(jobId, {
      includeResult: includeResult !== "false",
    });
  }

  @Delete("book/jobs/:jobId")
  @Public()
  @ApiOperation({ summary: "Delete a completed or failed book analysis job" })
  deleteBookAnalysisJob(@Param("jobId") jobId: string) {
    return this.bookAnalysis.deleteBookAnalysisJob(jobId);
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
    return this.bookAnalysis.searchBookAnalysisEvidence(
      jobId,
      query || "",
      limit ? Number(limit) : undefined,
    );
  }

  @Get("book/jobs")
  @Public()
  @ApiOperation({ summary: "List recent book analysis jobs" })
  listBookAnalysisJobs(@Query("limit") limit?: string) {
    return this.bookAnalysis.listBookAnalysisJobs(
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
    const exported = await this.bookAnalysis.exportBookAnalysisJob(
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
    return this.bookAnalysis.uploadBookFile({
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
    return this.bookAnalysis.getBookUpload(uploadId);
  }

  @Get("book/uploads")
  @Public()
  @ApiOperation({ summary: "List recent uploaded TXT files" })
  listBookUploads(@Query("limit") limit?: string) {
    return this.bookAnalysis.listBookUploads(
      limit ? Number(limit) : undefined,
    );
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
    return this.bookAnalysis.createBookAnalysisJobFromUpload({
      uploadId,
      provider: body.provider,
    });
  }
}
