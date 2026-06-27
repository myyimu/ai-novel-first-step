import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";

export class AskResearchLibraryDto {
  @ApiProperty({ type: ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider!: ProviderConfigDto;

  @ApiProperty({
    description: "Question to answer from persisted research assets.",
    example: "这些样本的开局承诺有什么共同点？",
  })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  question!: string;

  @ApiPropertyOptional({
    description:
      "Optional succeeded book-analysis job ids to restrict the source set.",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  jobIds?: string[];

  @ApiPropertyOptional({
    description: "Answer style.",
    enum: ["beginner", "editor", "prompt"],
    example: "beginner",
  })
  @IsOptional()
  @IsIn(["beginner", "editor", "prompt"])
  answerMode?: "beginner" | "editor" | "prompt";
}
