import { basename } from "node:path";

function replacementCount(value: string) {
  return (value.match(/\uFFFD/g) || []).length;
}

function looksLikeMojibake(value: string) {
  return /[ÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(
    value,
  );
}

export function normalizeUploadFilename(filename?: string) {
  const fallback = "novel.txt";
  const raw = (filename || fallback).replace(/\\/g, "/");
  const safe = basename(raw) || fallback;
  if (!looksLikeMojibake(safe)) {
    return safe;
  }

  const decoded = Buffer.from(safe, "latin1").toString("utf8");
  if (
    decoded &&
    replacementCount(decoded) <= replacementCount(safe) &&
    decoded !== safe
  ) {
    return decoded;
  }

  return safe;
}
