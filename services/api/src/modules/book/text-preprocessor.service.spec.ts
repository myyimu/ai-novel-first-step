import { TextPreprocessorService } from "./text-preprocessor.service";

describe("TextPreprocessorService", () => {
  const service = new TextPreprocessorService();

  it("cleans TXT noise and splits heading-based chapters", () => {
    const result = service.preprocess(
      "\uFEFF第一章 开局\r\n主角被取消资格。\r\n\r\n第二章 旧案\r\n主角发现玉牌线索。\r\n",
    );

    expect(result.cleaning.cleanedLength).toBeLessThan(
      result.cleaning.rawLength,
    );
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0]).toMatchObject({
      id: "ch-0001",
      order: 1,
      title: "第一章 开局",
      text: "主角被取消资格。",
      splitBy: "heading",
    });
    expect(result.chapters[1].title).toBe("第二章 旧案");
  });

  it("falls back to auto chunks when headings are absent", () => {
    const result = service.preprocess(
      "第一段没有章节标题。\n\n第二段继续推进剧情。",
    );

    expect(result.chapters).toHaveLength(1);
    expect(result.chapters[0].title).toBe("自动分段");
    expect(result.chapters[0].splitBy).toBe("auto-chunk");
  });
});
