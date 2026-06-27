import { Module } from "@nestjs/common";
import { AiProviderModule } from "@/modules/ai-provider/ai-provider.module";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import { BookAnalysisJobService } from "./book-analysis-job.service";
import { BookAnalysisService } from "./book-analysis.service";
import { BookController } from "./book.controller";
import { BookExportService } from "./book-export.service";
import { BookUploadService } from "./book-upload.service";
import { TextPreprocessorService } from "./text-preprocessor.service";

@Module({
  imports: [AiProviderModule],
  controllers: [BookController],
  providers: [
    AnalysisPersistenceRepository,
    BookAnalysisJobService,
    BookAnalysisService,
    BookExportService,
    BookUploadService,
    TextPreprocessorService,
  ],
  // AnalysisPersistenceRepository is exported for LibraryModule; the rest are
  // private to the book module.
  exports: [AnalysisPersistenceRepository],
})
export class BookModule {}
