import type { Token, TokenizerStrategy } from "../tokenizer/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DefaultTokenizer } from "../tokenizer/default-tokenizer";

import { RsvpEngine } from "./rsvp-engine";

interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

describe("consumer-defined token metadata", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("copies token fields while retaining application-owned metadata by reference", () => {
    const meta = { start: 0, end: 4 };
    const token = { value: "echo", ovpIndex: 0, durationMultiplier: 1, meta, extra: "ignored" };
    const engine = new RsvpEngine<string, SourceSpan>();
    engine.loadTokens([token]);
    const snapshot = engine.getSnapshot();

    expect(snapshot.currentItem).not.toBe(token);
    expect(snapshot.currentItem).toStrictEqual({
      value: "echo",
      ovpIndex: 0,
      durationMultiplier: 1,
      meta,
    });
    expect(snapshot.currentItem?.meta).toBe(meta);
    expect(Object.isFrozen(meta)).toBe(false);

    token.value = "changed";
    token.meta = { start: 10, end: 17 };
    expect(engine.currentItem?.value).toBe("echo");
    expect(engine.currentItem?.meta).toBe(meta);
    engine.destroy();
  });

  it.each([undefined, null, false, 0, "", "label", 1n])(
    "preserves explicit metadata %s without interpreting it",
    (meta) => {
      const engine = new RsvpEngine<number>();
      engine.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1, meta }]);
      expect(engine.currentItem?.meta).toBe(meta);
      expect(Object.hasOwn(engine.currentItem!, "meta")).toBe(true);
      engine.destroy();
    },
  );

  it("does not add metadata to tokens that omit it, including default-tokenized input", () => {
    const engine = new RsvpEngine<string, SourceSpan | undefined>({
      tokenizer: new DefaultTokenizer<string>(),
    });
    engine.load("echo");
    expect(Object.hasOwn(engine.currentItem!, "meta")).toBe(false);
    engine.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
    expect(Object.hasOwn(engine.currentItem!, "meta")).toBe(false);
    expect(engine.currentItem?.meta).toBeUndefined();
    engine.destroy();
  });

  it("preserves source spans through playback, navigation, and presentation overrides", () => {
    const source = "echo 😀 echo\n\nend";
    const tokens: Token<string, SourceSpan>[] = [
      { value: "echo", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 4 } },
      { value: "😀", ovpIndex: 0, durationMultiplier: 1, meta: { start: 5, end: 7 } },
      { value: "echo", ovpIndex: 0, durationMultiplier: 1, meta: { start: 8, end: 12 } },
      { value: "end", ovpIndex: 0, durationMultiplier: 1, meta: { start: 14, end: 17 } },
    ];
    const tokenizer: TokenizerStrategy<string, SourceSpan> = { tokenize: vi.fn(() => tokens) };
    const engine = new RsvpEngine({
      tokenizer,
      msPerItem: 100,
    });
    engine.load(source);
    const initial = engine.getSnapshot();
    const unsubscribe = engine.subscribe((snapshot) => {
      const item = snapshot.currentItem!;
      expect(item.meta).toBe(tokens[snapshot.currentIndex].meta);
      expect(source.slice(item.meta.start, item.meta.end)).toBe(item.value);
    });

    expect(initial.currentItem?.meta).toBe(tokens[0].meta);
    engine.play();
    const timing = engine.getSnapshot().timing;
    engine.setOvpStrategy({ calculate: () => 1 });
    expect(engine.currentItem?.ovpIndex).toBe(1);
    expect(engine.getSnapshot().timing).toBe(timing);
    expect(initial.currentItem?.ovpIndex).toBe(0);
    vi.advanceTimersByTime(100);
    expect(engine.currentItem?.meta).toBe(tokens[1].meta);
    engine.setOvpStrategy(undefined);
    expect(engine.currentItem?.ovpIndex).toBe(0);
    engine.pause();
    engine.seek(2);
    expect(engine.currentItem?.meta).toBe(tokens[2].meta);
    engine.previous();
    expect(engine.currentItem?.meta).toBe(tokens[1].meta);
    engine.next();
    engine.stop();
    expect(engine.currentItem?.meta).toBe(tokens[0].meta);
    engine.play();
    vi.advanceTimersByTime(400);
    expect(engine.state).toBe("COMPLETED");
    expect(engine.currentItem?.meta).toBe(tokens[3].meta);
    expect(tokenizer.tokenize).toHaveBeenCalledExactlyOnceWith(source);
    unsubscribe();
    engine.destroy();
  });

  it("keeps pre-tokenized offsets and metadata when OVP preferences change", () => {
    const meta = { id: "application-item" };
    const engine = new RsvpEngine<string, typeof meta>();
    engine.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1, meta }]);
    const snapshot = engine.getSnapshot();
    engine.setOvpStrategy({ calculate: () => 0 });
    expect(engine.getSnapshot()).toBe(snapshot);
    engine.seek(0);
    expect(engine.currentItem?.ovpIndex).toBe(2);
    expect(engine.currentItem?.meta).toBe(meta);
    engine.destroy();
  });
});
