import type { OvpStrategy } from "./types";

/**
 * Default grapheme-aware Optimal Viewing Position strategy.
 */
export class DefaultOvpStrategy implements OvpStrategy {
  readonly #segmenter: Intl.Segmenter | undefined;

  constructor() {
    const Segmenter = globalThis.Intl?.Segmenter;
    this.#segmenter =
      typeof Segmenter === "function"
        ? new Segmenter(undefined, { granularity: "grapheme" })
        : undefined;
  }

  /**
   * Calculates the Optimal Viewing Position for text.
   * @returns The zero-based UTF-16 offset of the OVP grapheme.
   */
  public calculate(text: string): number {
    if (!text) {
      return 0;
    }

    const graphemes = this.#segmenter
      ? Array.from(this.#segmenter.segment(text))
      : segmentGraphemes(text);
    const content = graphemes.filter(({ segment }) => !isPunctuation(segment));

    if (content.length === 0) {
      return graphemes[0].index;
    }

    const target = content.length <= 3 ? 0 : Math.floor(content.length * 0.25);
    return content[target].index;
  }
}

interface Grapheme {
  readonly index: number;
  readonly segment: string;
}

function segmentGraphemes(text: string): Grapheme[] {
  const graphemes: Grapheme[] = [];
  let index = 0;
  for (const segment of text) {
    const previous = graphemes.at(-1);
    if (
      previous &&
      (/^[\p{M}\uFE0F]$/u.test(segment) ||
        segment === "\u200D" ||
        previous.segment.endsWith("\u200D"))
    ) {
      graphemes[graphemes.length - 1] = {
        index: previous.index,
        segment: previous.segment + segment,
      };
    } else {
      graphemes.push({ index, segment });
    }
    index += segment.length;
  }
  return graphemes;
}

function isPunctuation(value: string): boolean {
  return /^[\p{P}\p{Z}]+$/u.test(value);
}
