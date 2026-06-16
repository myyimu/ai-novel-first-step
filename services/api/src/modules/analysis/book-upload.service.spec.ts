import { normalizeUploadFilename } from "./upload-filename";

describe("normalizeUploadFilename", () => {
  it("keeps normal filenames unchanged", () => {
    expect(normalizeUploadFilename("我的小说.txt")).toBe("我的小说.txt");
    expect(normalizeUploadFilename("novel.txt")).toBe("novel.txt");
  });

  it("repairs latin1-decoded utf8 filenames", () => {
    const mojibake = Buffer.from("我的小说.txt", "utf8").toString("latin1");
    expect(normalizeUploadFilename(mojibake)).toBe("我的小说.txt");
  });

  it("removes browser supplied path segments", () => {
    expect(normalizeUploadFilename("C:\\fakepath\\我的小说.txt")).toBe(
      "我的小说.txt",
    );
  });
});
