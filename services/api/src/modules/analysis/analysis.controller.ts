import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "@/core/decorators/public.decorators";
import { AnalysisService } from "./analysis.service";
import { BuildRubricDto } from "./dto/build-rubric.dto";
import { InferReferenceProfileDto } from "./dto/infer-reference-profile.dto";
import { PreviewAnalysisDto } from "./dto/preview-analysis.dto";
import { QuickReviewDto } from "./dto/quick-review.dto";
import { ScoreChapterDto } from "./dto/score-chapter.dto";
import { TestProviderDto } from "@/modules/ai-provider/dto/provider-config.dto";

@ApiTags("analysis")
@Controller("analysis")
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

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
}
