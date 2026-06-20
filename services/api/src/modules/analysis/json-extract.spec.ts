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

  it("repairs common JSON issues like trailing commas", () => {
    expect(extractJson('{"scores":[{"score":7},],"ok":true,}')).toEqual({
      scores: [{ score: 7 }],
      ok: true,
    });
  });

  it("repairs missing commas between array objects", () => {
    expect(extractJson('{"items":[{"name":"a"}\n{"name":"b"}]}')).toEqual({
      items: [{ name: "a" }, { name: "b" }],
    });
  });

  it("repairs missing commas between array strings", () => {
    expect(extractJson('{"fixes":["补足互动"\n"前置卖点"]}')).toEqual({
      fixes: ["补足互动", "前置卖点"],
    });
  });

  it("repairs repeated parser-position comma failures", () => {
    expect(
      extractJson(
        '{"principles":[{"id":"p1","rules":["a" "b"]} {"id":"p2","rules":["c" "d"]}]}',
      ),
    ).toEqual({
      principles: [
        { id: "p1", rules: ["a", "b"] },
        { id: "p2", rules: ["c", "d"] },
      ],
    });
  });
});
