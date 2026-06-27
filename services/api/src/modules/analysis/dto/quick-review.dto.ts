import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsOptional,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";

export class QuickReviewDto {
  @ApiPropertyOptional({
    description:
      "Input source kind. Defaults to human-draft for backwards compatibility.",
    enum: ["human-draft", "ai-draft", "idea", "outline", "prompt"],
    example: "ai-draft",
  })
  @IsOptional()
  @IsString()
  @IsIn(["human-draft", "ai-draft", "idea", "outline", "prompt"])
  inputKind?: "human-draft" | "ai-draft" | "idea" | "outline" | "prompt";

  @ApiPropertyOptional({
    description: "Chapter title. If omitted, the LLM infers one.",
    example: "第一章 退婚之后",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description: "Genre hint. If omitted the LLM guesses from content.",
    example: "xuanhuan",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  genre?: string;

  @ApiProperty({
    description: "Chapter text to review (50-30000 chars).",
    example: "主角刚进入考场，就发现考官正是三年前废掉他经脉的人。",
  })
  @IsString()
  @MinLength(50)
  @MaxLength(30000)
  chapterText!: string;

  @ApiPropertyOptional({
    description:
      "The previous writing prompt, useful when chapterText is AI-generated.",
    example: "请写一个玄幻退婚流开头，主角要被羞辱后反击。",
  })
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  previousPrompt?: string;

  @ApiPropertyOptional({
    description:
      "Provider config. If omitted, the API uses the configured shared model path.",
    type: ProviderConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider?: ProviderConfigDto;
}
