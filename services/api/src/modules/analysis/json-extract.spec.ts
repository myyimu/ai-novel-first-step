import { extractJson } from "./json-extract";

describe("extractJson", () => {
  it("parses direct JSON", () => {
    expect(extractJson('{"ok":true}')).toEqual({ ok: true });
  });

  it("parses fenced JSON", () => {
    expect(extractJson('```json\n{"scores":[1,2]}\n```')).toEqual({
      scores: [1, 2],
    });
  });

  it("extracts a JSON object from explanatory text", () => {
    expect(
      extractJson(
        '这是分析结果：\n{"scores":[{"score":7}],"ok":true}\n请参考。',
      ),
    ).toEqual({
      scores: [{ score: 7 }],
      ok: true,
    });
  });
});
