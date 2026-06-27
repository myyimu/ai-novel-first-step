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

function replaceIllegalJsonControlChars(content: string) {
  return Array.from(content, (char) => {
    const code = char.charCodeAt(0);
    const isIllegalControlChar =
      code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d;
    return isIllegalControlChar ? " " : char;
  }).join("");
}

function normalizeJsonPunctuationOutsideStrings(content: string) {
  let result = "";
  let inString = false;
  let escaped = false;

  for (const char of content) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = inString;
      continue;
    }

    if (char === '"') {
      result += char;
      inString = !inString;
      continue;
    }

    if (!inString && char === "，") {
      result += ",";
      continue;
    }

    if (!inString && char === "：") {
      result += ":";
      continue;
    }

    result += char;
  }

  return result;
}

function isDigit(char: string) {
  return char >= "0" && char <= "9";
}

function isValueStartChar(char: string | undefined) {
  if (!char) {
    return false;
  }

  return (
    char === "{" ||
    char === "[" ||
    char === '"' ||
    char === "-" ||
    isDigit(char) ||
    char === "t" ||
    char === "f" ||
    char === "n"
  );
}

function isValueEndChar(char: string | undefined) {
  if (!char) {
    return false;
  }

  return (
    char === "}" ||
    char === "]" ||
    char === '"' ||
    isDigit(char) ||
    char === "e" ||
    char === "E" ||
    char === "l"
  );
}

function insertMissingCommasByStructure(content: string) {
  let result = "";
  let inString = false;
  let escaped = false;
  const stack: Array<"{" | "["> = [];

  const lastNonWhitespaceChar = () => {
    for (let index = result.length - 1; index >= 0; index -= 1) {
      const char = result[index];
      if (!/\s/.test(char)) {
        return char;
      }
    }
    return undefined;
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      if (inString) {
        escaped = true;
      }
      continue;
    }

    if (!inString) {
      const top = stack[stack.length - 1];
      const previous = lastNonWhitespaceChar();
      const needsCommaBeforeArrayValue =
        top === "[" &&
        isValueStartChar(char) &&
        isValueEndChar(previous) &&
        previous !== "," &&
        previous !== "[" &&
        previous !== ":";

      if (needsCommaBeforeArrayValue) {
        result += ",";
      }

      const needsCommaBeforeObjectKey =
        top === "{" &&
        char === '"' &&
        isValueEndChar(previous) &&
        previous !== "," &&
        previous !== ":" &&
        previous !== "{";

      if (needsCommaBeforeObjectKey) {
        result += ",";
      }
    }

    result += char;

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      stack.pop();
    }
  }

  return result;
}

function lightRepairJsonString(content: string) {
  const repaired = normalizeJsonPunctuationOutsideStrings(content)
    .replace(/^\uFEFF/, "")
    .replace(/[鈥溾€漖]/g, '"')
    .replace(/[鈥樷€橾]/g, "'")
    .replace(/}\s*(?={)/g, "},")
    .replace(/]\s*(?=[{"])/g, "],")
    .replace(/"(\s*)(?=")/g, '",$1')
    .replace(/,\s*([}\]])/g, "$1");

  return replaceIllegalJsonControlChars(
    insertMissingCommasByStructure(repaired),
  );
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

function truncateDanglingJsonTail(content: string) {
  let candidate = content.trimEnd();
  candidate = candidate.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  candidate = candidate.replace(/,\s*$/, "");
  candidate = candidate.replace(/:\s*$/, "");
  return candidate;
}

function completeTruncatedJsonCandidate(content: string) {
  const objectStart = content.indexOf("{");
  const arrayStart = content.indexOf("[");
  const starts = [objectStart, arrayStart].filter((index) => index >= 0);
  if (starts.length === 0) {
    return undefined;
  }

  const start = Math.min(...starts);
  let candidate = content.slice(start).trim();
  const stack: Array<"{" | "["> = [];
  let inString = false;
  let escaped = false;

  for (const char of candidate) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      stack.push(char);
      continue;
    }

    if (char === "}" || char === "]") {
      stack.pop();
    }
  }

  candidate = truncateDanglingJsonTail(candidate);
  if (inString) {
    candidate += '"';
  }

  for (let index = stack.length - 1; index >= 0; index -= 1) {
    candidate += stack[index] === "{" ? "}" : "]";
  }

  return candidate;
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
    const parsedBalanced = tryParseJson(balanced);
    if (parsedBalanced !== undefined) {
      return parsedBalanced;
    }

    {
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
    }
  }

  const completed = completeTruncatedJsonCandidate(trimmed);
  if (completed) {
    const parsedCompleted = tryParseJson(lightRepairJsonString(completed));
    if (parsedCompleted !== undefined) {
      return parsedCompleted;
    }
  }

  throw new BadRequestException("Provider response did not include JSON.");
}
