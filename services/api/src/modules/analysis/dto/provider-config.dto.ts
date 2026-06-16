import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class ProviderConfigDto {
  @ApiPropertyOptional({
    description:
      "Provider preset used to prefill base URL and model. User-owned key is still sent per request only.",
    enum: [
      "custom",
      "ai-horde",
      "openrouter-free",
      "shared-gpu",
      "deepseek",
      "doubao",
      "qwen",
      "ollama",
    ],
    example: "deepseek",
  })
  @IsOptional()
  @IsIn([
    "custom",
    "ai-horde",
    "openrouter-free",
    "shared-gpu",
    "deepseek",
    "doubao",
    "qwen",
    "ollama",
  ])
  preset?:
    | "custom"
    | "ai-horde"
    | "openrouter-free"
    | "shared-gpu"
    | "deepseek"
    | "doubao"
    | "qwen"
    | "ollama";

  @ApiProperty({
    description: "Provider adapter used by the local API.",
    enum: ["mock", "openai-compatible", "ai-horde"],
    example: "openai-compatible",
  })
  @IsIn(["mock", "openai-compatible", "ai-horde"])
  kind!: "mock" | "openai-compatible" | "ai-horde";

  @ApiPropertyOptional({
    description:
      "OpenAI-compatible base URL, for example Volcengine Ark or DeepSeek.",
    example: "https://ark.cn-beijing.volces.com/api/v3",
  })
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @ApiPropertyOptional({
    description:
      "User-owned API key. The MVP sends it per request and does not persist it.",
    example: "sk-...",
  })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional({
    description: "Model name or endpoint id accepted by the provider.",
    example: "doubao-seed-1-6",
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: "Sampling temperature for analysis calls.",
    example: 0.2,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: "Whether to send response_format json_object.",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  jsonMode?: boolean;
}

export class TestProviderDto {
  @ApiProperty({ type: ProviderConfigDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ProviderConfigDto)
  provider!: ProviderConfigDto;
}
