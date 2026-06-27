/**
 * Stateless coercion helpers shared by analysis services.
 *
 * These are intentionally pure functions, not class methods — both the
 * diagnosis and book analysis services need them, and neither benefits from
 * holding them as instance methods (they touch no state).
 */

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item)).filter((item) => item.length > 0);
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}
