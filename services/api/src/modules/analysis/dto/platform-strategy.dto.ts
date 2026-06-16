import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export const competitionLevelValues = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;
export const pushStageValues = [
  "cold-start",
  "second-push",
  "stable",
  "recycle",
  "unknown",
] as const;

export class PlatformStrategyDto {
  @ApiProperty({
    description:
      "Assumed recommendation signals used by the target platform, editable by the user.",
    required: false,
    example: ["点击率", "有效阅读", "完读/触底", "加书架", "追更"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recommendationSignals?: string[];

  @ApiProperty({
    description: "Estimated competition intensity of the target lane.",
    required: false,
    enum: competitionLevelValues,
    example: "high",
  })
  @IsOptional()
  @IsIn(competitionLevelValues)
  competitionLevel?: string;

  @ApiProperty({
    description:
      "User notes about saturation, differentiation, or comparable titles.",
    required: false,
    example: "同质化逆袭开局很多，需要更早给出差异化钩子。",
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  competitionNotes?: string;

  @ApiProperty({
    description: "Likely recommendation/push stage for this chapter or work.",
    required: false,
    enum: pushStageValues,
    example: "cold-start",
  })
  @IsOptional()
  @IsIn(pushStageValues)
  pushStage?: string;

  @ApiProperty({
    description:
      "Likely traffic entry points, tags, or recommendation surfaces.",
    required: false,
    example: ["推荐流", "分类页", "关键词标签"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  trafficEntry?: string[];
}
