import { Injectable } from "@nestjs/common";

export interface ChapterSegment {
  id: string;
  order: number;
  title: string;
  text: string;
  charCount: number;
  wordCount: number;
  startOffset: number;
  endOffset: number;
  splitBy: "heading" | "auto-chunk";
}

export interface BookPreprocessResult {
  cleaning: {
    rawLength: number;
    cleanedLength: number;
    paragraphCount: number;
    removedNoise: string[];
  };
  chapters: ChapterSegment[];
}

@Injectable()
export class TextPreprocessorService {
  preprocess(text: string, maxChapterChars = 12000): BookPreprocessResult {
    const cleanedText = this.cleanText(text);
    const chapters = this.splitChapters(cleanedText, maxChapterChars);

    return {
      cleaning: {
        rawLength: text.length,
        cleanedLength: cleanedText.length,
        paragraphCount: cleanedText
          .split(/\n{2,}/)
          .map((item) => item.trim())
          .filter(Boolean).length,
        removedNoise: [
          "BOM",
          "Windows CRLF",
          "full-width spaces",
          "repeated blank lines",
          "leading/trailing whitespace",
        ],
      },
      chapters,
    };
  }

  cleanText(text: string): string {
    return text
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u3000/g, " ")
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
  }

  private splitChapters(
    text: string,
    maxChapterChars: number,
  ): ChapterSegment[] {
    const headingPattern =
      /^\s*((?:第[零〇一二两三四五六七八九十百千万\d]+[章节回卷部集][^\n]{0,60})|(?:Chapter\s+\d+[^\n]{0,60})|(?:\d{1,4}[、.．]\s*[^\n]{1,60}))\s*$/gim;
    const matches = [...text.matchAll(headingPattern)].filter(
      (match) => match.index !== undefined,
    );

    if (matches.length === 0) {
      return this.autoChunk(text, maxChapterChars);
    }

    const segments: ChapterSegment[] = [];
    const firstIndex = matches[0]?.index ?? 0;
    if (firstIndex > 0) {
      segments.push(
        this.createSegment({
          order: segments.length + 1,
          title: "开篇",
          text: text.slice(0, firstIndex),
          startOffset: 0,
          endOffset: firstIndex,
          splitBy: "heading",
        }),
      );
    }

    matches.forEach((match, index) => {
      const startOffset = (match.index ?? 0) + match[0].length;
      const endOffset = matches[index + 1]?.index ?? text.length;
      segments.push(
        this.createSegment({
          order: segments.length + 1,
          title: match[1].trim(),
          text: text.slice(startOffset, endOffset),
          startOffset,
          endOffset,
          splitBy: "heading",
        }),
      );
    });

    return segments.flatMap((segment) =>
      segment.charCount > maxChapterChars
        ? this.autoChunk(
            segment.text,
            maxChapterChars,
            segment.title,
            segment.order,
          )
        : [segment],
    );
  }

  private autoChunk(
    text: string,
    maxChapterChars: number,
    titlePrefix = "自动分段",
    baseOrder = 0,
  ): ChapterSegment[] {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);
    const chunks: Array<{
      text: string;
      startOffset: number;
      endOffset: number;
    }> = [];
    let current = "";
    let startOffset = 0;
    let cursor = 0;

    paragraphs.forEach((paragraph) => {
      const next = current ? `${current}\n\n${paragraph}` : paragraph;
      if (next.length > maxChapterChars && current) {
        chunks.push({
          text: current,
          startOffset,
          endOffset: startOffset + current.length,
        });
        startOffset = cursor;
        current = paragraph;
      } else {
        current = next;
      }
      cursor += paragraph.length + 2;
    });

    if (current) {
      chunks.push({
        text: current,
        startOffset,
        endOffset: startOffset + current.length,
      });
    }

    return chunks.map((chunk, index) =>
      this.createSegment({
        order: baseOrder ? baseOrder + index : index + 1,
        title:
          chunks.length === 1 ? titlePrefix : `${titlePrefix} ${index + 1}`,
        text: chunk.text,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        splitBy: "auto-chunk",
      }),
    );
  }

  private createSegment(input: {
    order: number;
    title: string;
    text: string;
    startOffset: number;
    endOffset: number;
    splitBy: ChapterSegment["splitBy"];
  }): ChapterSegment {
    const text = input.text.trim();

    return {
      id: `ch-${String(input.order).padStart(4, "0")}`,
      order: input.order,
      title: input.title || `第 ${input.order} 段`,
      text,
      charCount: text.length,
      wordCount: this.countWords(text),
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      splitBy: input.splitBy,
    };
  }

  private countWords(text: string): number {
    const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const latin = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
    return cjk + latin;
  }
}
