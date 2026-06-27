import { Module } from "@nestjs/common";
import { ModelProviderService } from "./model-provider.service";

@Module({
  providers: [ModelProviderService],
  exports: [ModelProviderService],
})
export class AiProviderModule {}
