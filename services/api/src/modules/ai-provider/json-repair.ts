import { BadRequestException } from "@nestjs/common";
import { ProviderConfigDto } from "./dto/provider-config.dto";
import { extractJson } from "./json-extract";
import { ModelProviderService } from "./model-provider.service";

/**
 * Parse a model response as JSON, falling back to a one-shot LLM repair pass
 * when the raw text cannot be coerced into JSON locally.
 *
 * Extracted from AnalysisService so both diagnosis and book-analysis services
 * can reuse the same repair flow without inheriting an instance method.
 */
export async function parseJsonWithRepair(
  modelProviders: ModelProviderService,
  provider: ProviderConfigDto,
  content: string,
  taskLabel: string,
) {
  try {
    return extractJson(content);
  } catch (error) {
    if (provider.kind === "mock") {
      throw error;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown JSON parse error";
    const repaired = await modelProviders.chat(
      provider,
      [
        {
          role: "system",
          content:
            "你是 JSON 修复器。把用户提供的内容修复成合法 JSON。只返回修复后的 JSON，不要解释，不要 Markdown。",
        },
        {
          role: "user",
          content: `下面是 ${taskLabel} 的模型原始输出。它应该是 JSON，但当前无法解析。

请尽量保留原始字段和值，只修复 JSON 语法问题。如果有明显截断或缺失，优先保留能确定的结构，不要编造新字段。

解析错误：
${errorMessage}

原始输出：
${content}`,
        },
      ],
      { maxOutputTokens: 3200 },
    );

    try {
      return extractJson(repaired);
    } catch (repairError) {
      const repairMessage =
        repairError instanceof Error
          ? repairError.message
          : "Unknown repaired JSON parse error";
      throw new BadRequestException(
        `${errorMessage}；自动修复后仍无法解析：${repairMessage}`,
      );
    }
  }
}
