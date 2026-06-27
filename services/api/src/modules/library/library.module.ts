import { Module } from "@nestjs/common";
import { AiProviderModule } from "@/modules/ai-provider/ai-provider.module";
import { BookModule } from "@/modules/book/book.module";
import { LibraryController } from "./library.controller";
import { ResearchLibraryService } from "./research-library.service";

@Module({
  imports: [AiProviderModule, BookModule],
  controllers: [LibraryController],
  providers: [ResearchLibraryService],
})
export class LibraryModule {}
