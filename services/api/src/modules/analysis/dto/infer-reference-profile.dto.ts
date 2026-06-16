import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { ProviderConfigDto } from "./provider-config.dto";

export class InferReferenceProfileDto {
  @ApiProperty({ type: ProviderConfigDto })
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider!: ProviderConfigDto;

  @ApiProperty({
    description: "Reference chapter title, if already known.",
    required: false,
    example: "第一章 少年被逐",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceTitle?: string;

  @ApiProperty({
    description: "Target platform style used as context.",
    enum: ["qidian", "fanqie", "jinjiang", "qimao", "wechat-short", "other"],
    example: "fanqie",
  })
  @IsIn(["qidian", "fanqie", "jinjiang", "qimao", "wechat-short", "other"])
  platform!: string;

  @ApiProperty({
    description: "Target reader preference profile used as context.",
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
    description: "Dominant reading scenario used as context.",
    enum: ["long-serialization", "mobile-fragmented", "short-paid", "other"],
    example: "mobile-fragmented",
  })
  @IsIn(["long-serialization", "mobile-fragmented", "short-paid", "other"])
  readingMode!: string;

  @ApiProperty({
    description: "Reference chapter text from a mature web novel.",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(80)
  @MaxLength(30000)
  referenceText!: string;
}
