import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";
import { PlatformStrategyDto } from "./platform-strategy.dto";

export class BuildRubricDto extends PlatformStrategyDto {
  @ApiProperty({ type: ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider!: ProviderConfigDto;

  @ApiProperty({
    description: "Reference chapter title.",
    example: "第一章 少年被逐",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  referenceTitle!: string;

  @ApiProperty({
    description: "Genre used to tune the critique rubric.",
    enum: [
      "xuanhuan",
      "urban",
      "romance",
      "suspense",
      "infinite-flow",
      "other",
    ],
    example: "xuanhuan",
  })
  @IsIn(["xuanhuan", "urban", "romance", "suspense", "infinite-flow", "other"])
  genre!: string;

  @ApiProperty({
    description: "Target platform style used to tune the rubric.",
    enum: ["qidian", "fanqie", "jinjiang", "qimao", "wechat-short", "other"],
    example: "fanqie",
  })
  @IsIn(["qidian", "fanqie", "jinjiang", "qimao", "wechat-short", "other"])
  platform!: string;

  @ApiProperty({
    description: "Target reader preference profile.",
    enum: [
      "male-fast-paced",
      "female-emotional",
      "setting-heavy",
      "light-reader",
      "suspense-brainstorm",
      "other",
    ],
    example: "male-fast-paced",
  })
  @IsIn([
    "male-fast-paced",
    "female-emotional",
    "setting-heavy",
    "light-reader",
    "suspense-brainstorm",
    "other",
  ])
  audience!: string;

  @ApiProperty({
    description: "Dominant reading scenario.",
    enum: ["long-serialization", "mobile-fragmented", "short-paid", "other"],
    example: "mobile-fragmented",
  })
  @IsIn(["long-serialization", "mobile-fragmented", "short-paid", "other"])
  readingMode!: string;

  @ApiProperty({
    description:
      "More specific market category, such as 都市神医 or 追妻火葬场.",
    example: "都市神医",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @ApiProperty({
    description: "Primary theme promise for the target readers.",
    example: "逆袭打脸",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  theme!: string;

  @ApiProperty({
    description: "Reader-facing tags or tropes.",
    example: ["神医", "退婚", "豪门", "隐藏身份"],
  })
  @IsArray()
  @IsString({ each: true })
  tags!: string[];

  @ApiProperty({
    description:
      "Visible keywords that may appear in title, intro, or chapter text.",
    example: ["退婚", "银针", "豪门千金"],
  })
  @IsArray()
  @IsString({ each: true })
  explicitKeywords!: string[];

  @ApiProperty({
    description: "Implicit reader expectations represented by the tags.",
    example: ["被低估", "公开羞辱", "医术反转", "身份揭露"],
  })
  @IsArray()
  @IsString({ each: true })
  implicitExpectations!: string[];

  @ApiProperty({
    description:
      "Optional title or synopsis promise to compare against chapter delivery.",
    required: false,
    example: "退婚当天，我用九根银针救下豪门千金",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  positioningPromise?: string;

  @ApiProperty({
    description: "Reference chapter text from a mature web novel.",
  })
  @IsString()
  @MinLength(80)
  @MaxLength(30000)
  referenceText!: string;
}
