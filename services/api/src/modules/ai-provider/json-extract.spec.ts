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

  it("repairs mixed adjacent array values", () => {
    expect(
      extractJson(
        '{"items":[{"name":"a"} {"name":"b"} "tail" true null 3 ["x" "y"]]}',
      ),
    ).toEqual({
      items: [{ name: "a" }, { name: "b" }, "tail", true, null, 3, ["x", "y"]],
    });
  });

  it("repairs missing commas between object fields", () => {
    expect(extractJson('{"title":"demo" "summary":"ok" "score":7}')).toEqual({
      title: "demo",
      summary: "ok",
      score: 7,
    });
  });

  it("normalizes full-width json punctuation outside strings", () => {
    expect(extractJson('{"a"：1，"b"：[1，2，3]}')).toEqual({
      a: 1,
      b: [1, 2, 3],
    });
  });

  it("completes JSON that was truncated before closing containers", () => {
    expect(extractJson('{"title":"demo","items":[{"name":"a"}')).toEqual({
      title: "demo",
      items: [{ name: "a" }],
    });
  });

  it("drops a dangling object key from truncated JSON", () => {
    expect(
      extractJson('{"title":"demo","items":[{"name":"a"}],"next":'),
    ).toEqual({
      title: "demo",
      items: [{ name: "a" }],
    });
  });
});
