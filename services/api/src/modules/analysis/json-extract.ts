import { BadRequestException } from "@nestjs/common";

function tryParseJson(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return undefined;
  }
}

function tryParseJsonWithTargetedCommaRepair(content: string) {
  let candidate = content;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const matched = message.match(
        /Expected ',' or '[}\]]' after (?:array element|property value) in JSON at position (\d+)/,
      );
      if (!matched?.[1]) {
        return undefined;
      }

      const position = Number(matched[1]);
      if (
        !Number.isInteger(position) ||
        position <= 0 ||
        position >= candidate.length
      ) {
        return undefined;
      }

      candidate = `${candidate.slice(0, position)},${candidate.slice(position)}`;
    }
  }

  return undefined;
}

function lightRepairJsonString(content: string) {
  return content
    .replace(/^\uFEFF/, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/}\s*(?={)/g, "},")
    .replace(/]\s*(?=[{"])/g, "],")
    .replace(/"(\s*)(?=")/g, '",$1')
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
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

  const repairedDirect = tryParseJson(lightRepairJsonString(trimmed));
  if (repairedDirect !== undefined) {
    return repairedDirect;
  }

  const targetedDirect = tryParseJsonWithTargetedCommaRepair(
    lightRepairJsonString(trimmed),
  );
  if (targetedDirect !== undefined) {
    return targetedDirect;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsedFence = tryParseJson(fenced[1].trim());
    if (parsedFence !== undefined) {
      return parsedFence;
    }

    const repairedFence = tryParseJson(lightRepairJsonString(fenced[1].trim()));
    if (repairedFence !== undefined) {
      return repairedFence;
    }

    const targetedFence = tryParseJsonWithTargetedCommaRepair(
      lightRepairJsonString(fenced[1].trim()),
    );
    if (targetedFence !== undefined) {
      return targetedFence;
    }
  }

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) {
    try {
      return JSON.parse(balanced);
    } catch (error) {
      const repairedBalanced = tryParseJson(lightRepairJsonString(balanced));
      if (repairedBalanced !== undefined) {
        return repairedBalanced;
      }
      const targetedBalanced = tryParseJsonWithTargetedCommaRepair(
        lightRepairJsonString(balanced),
      );
      if (targetedBalanced !== undefined) {
        return targetedBalanced;
      }
      throw new BadRequestException(
        `Provider response JSON parse failed: ${(error as Error).message}`,
      );
    }
  }

  throw new BadRequestException("Provider response did not include JSON.");
}
