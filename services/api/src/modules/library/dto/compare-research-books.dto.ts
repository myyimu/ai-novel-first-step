import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CompareResearchBooksDto {
  @ApiProperty({
    description: "Succeeded book-analysis job ids to compare.",
    example: ["job_a", "job_b"],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  jobIds!: string[];

  @ApiPropertyOptional({
    description: "Optional comparison focus, such as opening hook or emotion.",
    example: "对比开局承诺、爽点组合和差异化机会",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  focus?: string;

  @ApiPropertyOptional({
    description: "Whether to include a reusable first-prompt seed.",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includePromptSeed?: boolean;
}
