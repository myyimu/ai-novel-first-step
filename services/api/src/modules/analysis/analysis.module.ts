import { Module } from "@nestjs/common";
import { AnalysisController } from "./analysis.controller";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import { AnalysisService } from "./analysis.service";
import { BookAnalysisJobService } from "./book-analysis-job.service";
import { BookExportService } from "./book-export.service";
import { BookUploadService } from "./book-upload.service";
import { ModelProviderService } from "./model-provider.service";
import { ResearchLibraryService } from "./research-library.service";
import { TextPreprocessorService } from "./text-preprocessor.service";

@Module({
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    AnalysisPersistenceRepository,
    BookAnalysisJobService,
    BookExportService,
    BookUploadService,
    ModelProviderService,
    ResearchLibraryService,
    TextPreprocessorService,
  ],
})
export class AnalysisModule {}
