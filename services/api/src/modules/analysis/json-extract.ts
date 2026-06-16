import { BadRequestException } from "@nestjs/common";

function tryParseJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function extractBalancedJsonObject(content: string) {
  const start = content.indexOf("{");
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      depth += 1;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return content.slice(start, index + 1);
      }
    }
  }

  const end = content.lastIndexOf("}");
  return end > start ? content.slice(start, end + 1) : undefined;
}

export function extractJson(content: string) {
  const trimmed = content.trim();
  const direct = tryParseJson(trimmed);
  if (direct !== undefined) {
    return direct;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsedFence = tryParseJson(fenced[1].trim());
    if (parsedFence !== undefined) {
      return parsedFence;
    }
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch (error) {
      throw new BadRequestException(
        `Provider response JSON parse failed: ${(error as Error).message}`,
      );
    }
  }

  throw new BadRequestException("Provider response did not include JSON.");
}
