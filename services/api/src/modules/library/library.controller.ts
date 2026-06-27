import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "@/core/decorators/public.decorators";
import { AskResearchLibraryDto } from "./dto/ask-research-library.dto";
import { CompareResearchBooksDto } from "./dto/compare-research-books.dto";
import { ResearchLibraryService } from "./research-library.service";

@ApiTags("analysis")
@Controller("analysis/research")
export class LibraryController {
  constructor(private readonly researchLibrary: ResearchLibraryService) {}

  @Get("library")
  @Public()
  @ApiOperation({
    summary: "Read persisted research-library assets derived from book jobs",
  })
  getResearchLibrary(@Query("limit") limit?: string) {
    return this.researchLibrary.getLibrary(limit ? Number(limit) : undefined);
  }

  @Post("compare")
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

  @Post("ask")
  @HttpCode(200)
  @Public()
  @ApiOperation({
    summary: "Answer a question from persisted research-library assets",
  })
  askResearchLibrary(@Body() body: AskResearchLibraryDto): Promise<unknown> {
    return this.researchLibrary.answerQuestion(body);
  }
}
