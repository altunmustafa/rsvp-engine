import type { OvpStrategy, Token, TokenizerStrategy } from "../tokenizer/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EngineDestroyedError,
  EngineError,
  InvalidInputError,
  ItemSelectionError,
} from "../errors";
import { DefaultOvpStrategy } from "../tokenizer/default-ovp-strategy";
import { TextTokenizer } from "../tokenizer/text-tokenizer";

import { RsvpEngine } from "./rsvp-engine";

const firstCharacter: OvpStrategy = { calculate: () => 0 };
const lastCharacter: OvpStrategy = { calculate: (text) => Math.max(0, text.length - 1) };

describe("Presentation OVP strategies", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("preserves the original custom tokenizer contract and separates presentation preferences", () => {
    class UppercaseTokenizer implements TokenizerStrategy<string> {
      public tokenize(data: string | string[]): Token<string>[] {
        return (Array.isArray(data) ? data : [data]).map((value) => ({
          value,
          ovpIndex: 2,
          durationMultiplier: 3,
        }));
      }
    }
    const tokenizer = new UppercaseTokenizer();
    const first = new RsvpEngine({
      tokenizer,
    });
    first.load("hello");
    const second = new RsvpEngine({
      tokenizer,
    });
    second.load("hello");
    const calculate = vi.fn(() => 0);
    first.setOvpStrategy({ calculate });
    expect(first.currentItem).toMatchObject({ value: "hello", ovpIndex: 0, durationMultiplier: 3 });
    expect(calculate).toHaveBeenCalledWith("hello");
    first.load("world");
    expect(first.currentItem?.ovpIndex).toBe(0);
    second.load("world");
    expect(second.currentItem?.ovpIndex).toBe(2);
    expect(tokenizer.tokenize("world")[0].ovpIndex).toBe(2);
    first.destroy();
    second.destroy();
  });

  it("keeps tokenizer offsets and only calculates presentation for the selected word", () => {
    const oldCalculate = vi.fn(() => 1);
    const tokenizer = new TextTokenizer({ ovpStrategy: { calculate: oldCalculate } });
    const engine = new RsvpEngine({ tokenizer });
    const calculate = vi.fn(() => 0);
    engine.setOvpStrategy({ calculate });
    engine.load("hello world");
    expect(oldCalculate.mock.calls).toEqual([["hello"], ["world"]]);
    expect(calculate.mock.calls).toEqual([["hello"]]);
    engine.play();
    vi.advanceTimersByTime(engine.msPerItem);
    expect(calculate.mock.calls).toEqual([["hello"], ["world"]]);
    engine.destroy();
  });

  it.each(["IDLE", "PAUSED", "STOPPED", "COMPLETED"] as const)(
    "prepares replacement input once from %s, even when its first index matches the old selection",
    (state) => {
      const calculate = vi.fn(lastCharacter.calculate);
      const engine = new RsvpEngine({
        tokenizer: new TextTokenizer(),
        wpm: 1000,
        ovpStrategy: { calculate },
      });
      engine.load(["hello", "world"]);
      if (state === "PAUSED") {
        engine.seek(1);
      } else if (state === "STOPPED") {
        engine.play();
        engine.stop();
      } else if (state === "COMPLETED") {
        engine.play();
        vi.advanceTimersByTime(120);
      }
      const before = engine.getSnapshot();
      const listener = vi.fn();
      engine.subscribe(listener);
      calculate.mockClear();
      engine.load(["again", "later"]);
      expect(calculate.mock.calls).toEqual([["again"]]);
      expect(engine.getSnapshot()).toMatchObject({
        state: "IDLE",
        currentIndex: 0,
        progress: 0,
        totalItems: 2,
        currentItem: { value: "again", ovpIndex: 4 },
      });
      expect(engine.currentItem).not.toBe(before.currentItem);
      expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "loaded"]]);
      expect(vi.getTimerCount()).toBe(0);
      engine.play();
      expect(calculate).toHaveBeenCalledOnce();
      vi.advanceTimersByTime(60);
      expect(calculate.mock.calls).toEqual([["again"], ["later"]]);
      expect(engine.currentIndex).toBe(1);
      expect(engine.currentItem).toMatchObject({ value: "later", ovpIndex: 4 });
      vi.advanceTimersByTime(60);
      expect(engine.state).toBe("COMPLETED");
      engine.destroy();
    },
  );

  it("clears the selected item for empty replacement input and prepares later raw input", () => {
    const calculate = vi.fn(lastCharacter.calculate);
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      ovpStrategy: { calculate },
    });
    engine.load("hello world");
    engine.seek(1);
    calculate.mockClear();
    engine.load([]);
    expect(engine.getSnapshot()).toMatchObject({
      state: "IDLE",
      currentIndex: 0,
      currentItem: null,
      progress: 0,
      totalItems: 0,
    });
    engine.loadTokens([]);
    expect(engine.currentItem).toBeNull();
    expect(calculate).not.toHaveBeenCalled();
    engine.load("again");
    expect(calculate.mock.calls).toEqual([["again"]]);
    expect(engine.currentIndex).toBe(0);
    expect(engine.currentItem).toMatchObject({ value: "again", ovpIndex: 4 });
    engine.destroy();
  });

  it("clears the session when preparing replacement input fails", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
    });
    engine.load("hello world");
    engine.seek(1);
    const failure = new Error("replacement failed");
    engine.setOvpStrategy({
      calculate: (text) => {
        if (text === "broken") {
          throw failure;
        }
        return 0;
      },
    });
    const before = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    expect(() => engine.load("broken")).toThrow(
      expect.objectContaining({
        name: "SessionLoadError",
        isFatal: true,
        cause: failure,
      }),
    );
    expect(engine.getSnapshot()).toEqual({
      ...before,
      state: "ERROR",
      currentIndex: 0,
      currentItem: null,
      totalItems: 0,
      progress: 0,
      timing: { ...before.timing, totalDurationMs: 0, remainingDurationMs: null },
    });
    expect(engine.currentItem).toBeNull();
    expect(engine.currentIndex).toBe(0);
    expect(engine.totalItems).toBe(0);
    expect(engine.progress).toBe(0);
    expect(listener.mock.calls).toEqual([[engine.getSnapshot(), "stateChanged"]]);
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });

  it("clears a pre-tokenized session when replacement presentation throws", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    const failure = new Error("OVP calculation failed");
    engine.setOvpStrategy({
      calculate: () => {
        throw failure;
      },
    });
    engine.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1 }]);
    expect(() => engine.load("world")).toThrow(expect.objectContaining({ cause: failure }));
    expect(engine.getSnapshot()).toMatchObject({
      state: "ERROR",
      currentItem: null,
      currentIndex: 0,
      totalItems: 0,
      progress: 0,
    });
    engine.reset();
    engine.setOvpStrategy(firstCharacter);
    engine.load("world");
    expect(engine.currentItem?.ovpIndex).toBe(0);
    engine.destroy();
  });

  it("updates presentation atomically without rescheduling or resampling active playback", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world.");
    engine.play();
    const before = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    vi.advanceTimersByTime(40);

    engine.setOvpStrategy(lastCharacter);

    const updated = engine.getSnapshot();
    expect(updated).toEqual({ ...before, currentItem: { ...before.currentItem, ovpIndex: 4 } });
    expect(updated.timing).toBe(before.timing);
    expect(Object.isFrozen(updated.currentItem)).toBe(true);
    expect(before.currentItem?.ovpIndex).toBe(1);
    expect(listener.mock.calls).toEqual([[updated, "ovpChanged"]]);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(59);
    expect(engine.currentIndex).toBe(0);
    vi.advanceTimersByTime(1);
    expect(engine.currentIndex).toBe(1);
    expect(engine.currentItem).toMatchObject({ ovpIndex: 5, durationMultiplier: 2 });
    vi.advanceTimersByTime(200);
    expect(engine.state).toBe("COMPLETED");
    engine.destroy();
  });

  it("preserves paused remainder and updates previously presented items", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world");
    engine.play();
    vi.advanceTimersByTime(140);
    engine.pause();
    const before = engine.getSnapshot();
    vi.advanceTimersByTime(1000);
    engine.setOvpStrategy(lastCharacter);
    expect(engine.getSnapshot()).toEqual({
      ...before,
      currentItem: { ...before.currentItem, ovpIndex: 4 },
    });
    expect(engine.getSnapshot().timing).toBe(before.timing);
    engine.play();
    vi.advanceTimersByTime(59);
    expect(engine.state).toBe("PLAYING");
    vi.advanceTimersByTime(1);
    expect(engine.state).toBe("COMPLETED");
    engine.seek(0);
    expect(engine.currentItem?.ovpIndex).toBe(4);
    engine.destroy();
  });

  it.each(["IDLE", "PAUSED", "STOPPED", "COMPLETED"] as const)(
    "updates a raw-input session in %s without changing its lifecycle",
    (state) => {
      const engine = new RsvpEngine({
        tokenizer: new TextTokenizer(),
        wpm: 600,
      });
      engine.load("hello world");
      if (state === "PAUSED") {
        engine.seek(1);
      }
      if (state === "STOPPED") {
        engine.play();
        engine.stop();
      }
      if (state === "COMPLETED") {
        engine.play();
        vi.advanceTimersByTime(200);
      }
      const before = engine.getSnapshot();
      engine.setOvpStrategy(firstCharacter);
      expect(engine.getSnapshot()).toEqual({
        ...before,
        currentItem: { ...before.currentItem, ovpIndex: 0 },
      });
      expect(engine.getSnapshot().timing).toBe(before.timing);
      expect(vi.getTimerCount()).toBe(0);
      engine.destroy();
    },
  );

  it("saves preferences without notifying empty sessions and retains them across reset", () => {
    const tokenize = vi.fn((data: string | string[]) => {
      if (data === "fatal") {
        throw new Error("tokenizer failed");
      }
      return [{ value: "hello", ovpIndex: 1, durationMultiplier: 2 }];
    });
    const engine = new RsvpEngine({ tokenizer: { tokenize } });
    const initial = engine.getSnapshot();
    const calculate = vi.fn(lastCharacter.calculate);
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setOvpStrategy({ calculate });
    expect(engine.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
    expect(calculate).not.toHaveBeenCalled();
    engine.load("raw");
    expect(engine.currentItem).toMatchObject({ ovpIndex: 4, durationMultiplier: 2 });
    expect(() => engine.load("fatal")).toThrow(
      expect.objectContaining({
        cause: expect.objectContaining({ message: "tokenizer failed" }),
      }),
    );
    engine.reset();
    engine.load("new raw");
    expect(engine.currentItem?.ovpIndex).toBe(4);
    expect(calculate).toHaveBeenCalledTimes(2);
    engine.destroy();
  });

  it("never rewrites pre-tokenized offsets, including after strategy changes and replay", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world");
    engine.setOvpStrategy(firstCharacter);
    const tokens = [{ value: "hello", ovpIndex: 2, durationMultiplier: 1 }];
    engine.loadTokens(tokens);
    const supplied = engine.getSnapshot();
    const calculate = vi.fn(lastCharacter.calculate);
    engine.setOvpStrategy({ calculate });
    expect(engine.getSnapshot()).toBe(supplied);
    expect(calculate).not.toHaveBeenCalled();
    engine.play();
    engine.setOvpStrategy({ calculate });
    expect(engine.currentItem?.ovpIndex).toBe(2);
    engine.stop();
    engine.seek(0);
    engine.setOvpStrategy({ calculate });
    engine.play();
    vi.advanceTimersByTime(100);
    engine.setOvpStrategy({ calculate });
    engine.stop();
    engine.play();
    expect(engine.currentItem?.ovpIndex).toBe(2);
    expect(calculate).not.toHaveBeenCalled();
    expect(tokens[0].ovpIndex).toBe(2);
    engine.stop();
    engine.load("hello");
    expect(engine.currentItem?.ovpIndex).toBe(4);
    expect(calculate).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("preserves unchanged item and snapshot references but commits future-only preferences", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world");
    const before = engine.getSnapshot();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.setOvpStrategy(new DefaultOvpStrategy());
    engine.setOvpStrategy({ calculate: (text) => (text === "hello" ? 1 : 4) });
    expect(engine.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    engine.play();
    vi.advanceTimersByTime(100);
    expect(engine.currentItem?.ovpIndex).toBe(4);
    engine.stop();
    expect(engine.currentItem).toBe(before.currentItem);
    engine.load("world");
    expect(engine.currentItem?.ovpIndex).toBe(4);
    engine.destroy();
  });

  it("re-evaluates the same strategy instance and leaves generic items untouched", () => {
    const value = { image: "cover" };
    const engine = new RsvpEngine<string | typeof value>({
      tokenizer: {
        tokenize: () => [
          { value, ovpIndex: 0, durationMultiplier: 1 },
          { value: "hello", ovpIndex: 1, durationMultiplier: 1 },
        ],
      },
    });
    engine.load([value, "hello"]);
    const item = engine.currentItem;
    let offset = 0;
    const calculate = vi.fn(() => offset);
    const strategy = { calculate };
    engine.setOvpStrategy(strategy);
    expect(engine.currentItem).toBe(item);
    offset = 4;
    engine.setOvpStrategy(strategy);
    engine.seek(1);
    expect(engine.currentItem?.ovpIndex).toBe(4);
    engine.previous();
    expect(engine.currentItem).toBe(item);
    expect(engine.currentItem?.value).toBe(value);
    expect(calculate).toHaveBeenCalledOnce();
    engine.destroy();
  });

  it("applies grapheme-aware UTF-16 offsets to loaded and subsequent raw input", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.load(["Café", "👩🏽‍💻"]);
    engine.setOvpStrategy({ calculate: () => 0 });
    engine.setOvpStrategy(new DefaultOvpStrategy());
    expect(engine.currentItem?.ovpIndex).toBe(1);
    engine.seek(1);
    expect(engine.currentItem?.ovpIndex).toBe(0);
    engine.load(["👩🏽‍💻", "Café"]);
    expect(engine.currentItem?.ovpIndex).toBe(0);
    engine.destroy();
  });

  it.each([-1, 0.5, NaN, Infinity, 6])(
    "rejects offset %s atomically and retains the earlier strategy",
    (invalid) => {
      const engine = new RsvpEngine({
        tokenizer: new TextTokenizer(),
        wpm: 600,
      });
      engine.load("hello world");
      engine.setOvpStrategy(firstCharacter);
      engine.play();
      vi.advanceTimersByTime(40);
      const before = engine.getSnapshot();
      const listener = vi.fn();
      engine.subscribe(listener);
      expect(() => engine.setOvpStrategy({ calculate: () => invalid })).toThrow(InvalidInputError);
      const failed = engine.getSnapshot();
      expect(failed).toBe(before);
      expect(failed.currentItem).toBe(before.currentItem);
      expect(failed.timing).toBe(before.timing);
      expect(listener).not.toHaveBeenCalled();
      vi.advanceTimersByTime(60);
      expect(engine.currentIndex).toBe(1);
      expect(engine.currentItem).toMatchObject({ ovpIndex: 0 });
      engine.stop();
      engine.load("new text");
      expect(engine.currentItem?.ovpIndex).toBe(0);
      engine.destroy();
    },
  );

  it("rethrows strategy failures without interrupting playback or committing partial results", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world");
    engine.play();
    const before = engine.getSnapshot();
    const rootCause = new Error("OVP failed");
    const innerFailure = new EngineError("OVP failed", { cause: rootCause });
    const failure = new EngineError("OVP failed", { cause: innerFailure });
    let thrown: unknown;
    try {
      engine.setOvpStrategy({
        calculate: (text) => {
          if (text === "hello") {
            throw failure;
          }
          return 4;
        },
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
    expect(engine.getSnapshot()).toBe(before);
    expect(failure.cause).toBe(innerFailure);
    expect(innerFailure.cause).toBe(rootCause);
    vi.advanceTimersByTime(100);
    expect(engine.currentIndex).toBe(1);
    expect(engine.currentItem).toMatchObject({ ovpIndex: 1 });
    engine.destroy();
  });

  it("clears the session when replacement presentation has an invalid OVP offset", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.setOvpStrategy({ calculate: () => 100 });
    engine.loadTokens([{ value: "hello", ovpIndex: 2, durationMultiplier: 1 }]);
    const before = engine.getSnapshot();
    expect(() => engine.load("world")).toThrow(
      expect.objectContaining({
        cause: expect.any(InvalidInputError),
      }),
    );
    expect(engine.getSnapshot()).toEqual({
      ...before,
      state: "ERROR",
      currentIndex: 0,
      currentItem: null,
      totalItems: 0,
      progress: 0,
      timing: { ...before.timing, totalDurationMs: 0, remainingDurationMs: null },
    });
    expect(engine.currentItem).toBeNull();
    engine.reset();
    engine.setOvpStrategy(firstCharacter);
    engine.load("world");
    expect(engine.currentItem?.ovpIndex).toBe(0);
    engine.destroy();
  });

  it("keeps raw-input ownership after a rejected pre-tokenized load", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.load("hello");
    expect(() =>
      engine.loadTokens([{ value: "world", ovpIndex: -1, durationMultiplier: 1 }]),
    ).toThrow(InvalidInputError);
    engine.setOvpStrategy(lastCharacter);
    expect(engine.currentItem?.ovpIndex).toBe(4);
    engine.destroy();
  });

  it.each([
    { command: "pause", run: (engine: RsvpEngine) => engine.pause() },
    { command: "destroy", run: (engine: RsvpEngine) => engine.destroy() },
    { command: "setWpm", run: (engine: RsvpEngine) => engine.setWpm(300) },
    {
      command: "setOvpStrategy",
      run: (engine: RsvpEngine) => engine.setOvpStrategy(firstCharacter),
    },
  ])("rejects reentrant $command during strategy preparation", ({ run }) => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 600,
    });
    engine.load("hello world");
    engine.play();
    const before = engine.getSnapshot();
    expect(() =>
      engine.setOvpStrategy({
        calculate: () => {
          run(engine);
          return 4;
        },
      }),
    ).toThrow("Cannot mutate the engine while a strategy is executing.");
    expect(engine.getSnapshot()).toBe(before);
    expect(engine.getSnapshot().timing).toBe(before.timing);
    engine.setOvpStrategy(lastCharacter);
    vi.advanceTimersByTime(100);
    expect(engine.currentIndex).toBe(1);
    expect(engine.currentItem).toMatchObject({ ovpIndex: 4 });
    engine.destroy();
  });

  it("rejects strategy mutation during raw-input preparation and releases the guard on failure", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.setOvpStrategy({
      calculate: () => {
        engine.loadTokens([{ value: "nested", ovpIndex: 0, durationMultiplier: 1 }]);
        return 0;
      },
    });
    expect(() => engine.load("hello")).toThrow(
      expect.objectContaining({
        cause: expect.any(InvalidInputError),
      }),
    );
    expect(engine.state).toBe("ERROR");
    expect(engine.totalItems).toBe(0);
    engine.reset();
    engine.setOvpStrategy(firstCharacter);
    engine.load("world");
    expect(engine.currentItem?.value).toBe("world");
    engine.destroy();
  });

  it("rejects invalid strategy shapes even when no applicable items are loaded", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    for (const strategy of [null, {}, { calculate: 0 }]) {
      expect(() => engine.setOvpStrategy(strategy as unknown as OvpStrategy)).toThrow(
        InvalidInputError,
      );
    }
    engine.destroy();
  });

  it("rejects strategy changes in fatal ERROR and after destruction", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.load("hello");
    engine.play();
    const fatal = new EngineError("strategy failed", {
      cause: new Error("strategy failed"),
      isFatal: true,
    });
    const failure = new EngineError("strategy failed", { cause: fatal, isFatal: false });
    let thrown: unknown;
    try {
      engine.setOvpStrategy({
        calculate: () => {
          throw failure;
        },
      });
    } catch (error) {
      thrown = error;
    }
    expect(engine.state).toBe("ERROR");
    expect(thrown).toBe(failure);
    expect(failure.isFatal).toBe(true);
    expect(failure.cause).toBe(fatal);
    expect(vi.getTimerCount()).toBe(0);
    const before = engine.getSnapshot();
    expect(() => engine.setOvpStrategy(firstCharacter)).toThrow(InvalidInputError);
    expect(engine.getSnapshot()).toBe(before);
    engine.destroy();
    expect(() => engine.setOvpStrategy(lastCharacter)).toThrow(EngineDestroyedError);
  });

  it("accepts an optional constructor strategy and reuses the current result across notifications", () => {
    const calculate = vi.fn(lastCharacter.calculate);
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
      ovpStrategy: { calculate },
    });
    engine.load("hello world");
    expect(engine.currentItem?.ovpIndex).toBe(4);
    const item = engine.currentItem;
    expect(calculate.mock.calls).toEqual([["hello"]]);
    engine.play();
    engine.pause();
    engine.setWpm(900);
    engine.setMsPerItem(60);
    expect(engine.currentItem).toBe(item);
    expect(engine.getSnapshot().currentItem).toBe(item);
    expect(calculate).toHaveBeenCalledOnce();
    engine.play();
    vi.advanceTimersByTime(60);
    expect(calculate.mock.calls).toEqual([["hello"], ["world"]]);
    vi.advanceTimersByTime(60);
    expect(engine.state).toBe("COMPLETED");
    expect(calculate).toHaveBeenCalledTimes(2);
    engine.destroy();
  });

  it("restores original tokenizer offsets when the presentation strategy is removed", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
    });
    engine.load("hello world");
    const initial = engine.currentItem;
    engine.setOvpStrategy(lastCharacter);
    engine.play();
    vi.advanceTimersByTime(20);
    const timing = engine.getSnapshot().timing;
    engine.setOvpStrategy(undefined);
    expect(engine.currentItem).toBe(initial);
    expect(engine.getSnapshot().timing).toBe(timing);
    vi.advanceTimersByTime(40);
    expect(engine.currentItem).toMatchObject({ value: "world", ovpIndex: 1 });
    engine.stop();
    engine.load("hello");
    expect(engine.currentItem?.ovpIndex).toBe(1);
    engine.destroy();
  });

  it.each(["exception", "invalid offset"])(
    "enters ERROR on a future word's %s and cancels playback",
    (mode) => {
      const failure = new Error("future OVP failed");
      const calculate = vi.fn((text: string) => {
        if (text === "world") {
          if (mode === "exception") {
            throw failure;
          }
          return -1;
        }
        return 4;
      });
      const onError = vi.fn();
      const engine = new RsvpEngine({
        tokenizer: new TextTokenizer(),
        wpm: 1000,
        onError,
      });
      engine.load("hello world");
      engine.setOvpStrategy({ calculate });
      engine.play();
      const before = engine.currentItem;
      const listener = vi.fn();
      engine.subscribe(listener);
      expect(() => vi.advanceTimersByTime(60)).not.toThrow();
      expect(engine.state).toBe("ERROR");
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentItem).toBe(before);
      expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
      expect(onError.mock.calls[0]![0].message).toBe("Failed to prepare item at index 1.");
      expect(onError.mock.calls[0]![0]).toBeInstanceOf(ItemSelectionError);
      expect(onError.mock.calls[0]![0]).toMatchObject({ index: 1 });
      if (mode === "exception") {
        expect(onError.mock.calls[0]![0].cause).toBe(failure);
      }
      expect(engine.getSnapshot().timing.remainingDurationMs).toBeNull();
      expect(listener).toHaveBeenLastCalledWith(engine.getSnapshot(), "stateChanged");
      expect(vi.getTimerCount()).toBe(0);
      engine.reset();
      engine.load("hello");
      expect(engine.currentItem?.ovpIndex).toBe(4);
      engine.destroy();
    },
  );

  it("reports navigation calculation failures without publishing a mismatched item and index", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
    });
    engine.load("hello world");
    engine.setOvpStrategy({ calculate: (text) => (text === "world" ? -1 : 4) });
    expect(() => engine.seek(1)).toThrow(
      expect.objectContaining({
        name: "ItemSelectionError",
        index: 1,
        isFatal: true,
        cause: expect.any(InvalidInputError),
      }),
    );
    expect(engine.state).toBe("ERROR");
    expect(engine.currentItem).toMatchObject({ value: "hello", ovpIndex: 4 });
    expect(engine.currentIndex).toBe(0);
    engine.destroy();
  });

  it("rejects malformed constructor strategies", () => {
    expect(() => new RsvpEngine({ ovpStrategy: {} as OvpStrategy })).toThrow(InvalidInputError);
  });

  it("recalculates revisited words while preserving the selected result on repeated seek", () => {
    const calculate = vi.fn(lastCharacter.calculate);
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
      ovpStrategy: { calculate },
    });
    engine.load("hello world");
    engine.play();
    vi.advanceTimersByTime(20);
    engine.pause();
    const paused = engine.getSnapshot();
    expect(paused.timing.remainingDurationMs).toBe(100);
    engine.seek(0);
    const selected = engine.getSnapshot();
    expect(selected.currentItem).toBe(paused.currentItem);
    expect(selected.timing.remainingDurationMs).toBe(120);
    engine.seek(0);
    expect(engine.getSnapshot()).toBe(selected);
    expect(engine.currentItem).toBe(selected.currentItem);
    expect(calculate).toHaveBeenCalledOnce();
    engine.next();
    engine.next();
    expect(calculate.mock.calls).toEqual([["hello"], ["world"]]);
    engine.previous();
    engine.previous();
    expect(calculate.mock.calls).toEqual([["hello"], ["world"], ["hello"]]);
    engine.destroy();
  });

  it.each(["stop", "replay"])("enters ERROR when OVP preparation fails during %s", (command) => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
    });
    engine.load("hello world");
    engine.play();
    vi.advanceTimersByTime(command === "stop" ? 60 : 120);
    const item = engine.currentItem;
    const rootCause = new Error("first word failed");
    const failure = new EngineError("first word failed", { cause: rootCause });
    engine.setOvpStrategy({
      calculate: (text) => {
        if (text === "hello") {
          throw failure;
        }
        return 1;
      },
    });
    const progress = command === "stop" ? 0.5 : 1;
    expect(engine.progress).toBe(progress);
    if (command === "stop") {
      expect(() => engine.stop()).toThrow(
        expect.objectContaining({
          name: "ItemSelectionError",
          index: 0,
          isFatal: true,
          cause: failure,
        }),
      );
    } else {
      expect(() => engine.play()).toThrow(
        expect.objectContaining({
          name: "ItemSelectionError",
          index: 0,
          isFatal: true,
          cause: failure,
        }),
      );
    }
    expect(engine.state).toBe("ERROR");
    expect(engine.currentItem).toBe(item);
    expect(engine.currentIndex).toBe(1);
    expect(failure.cause).toBe(rootCause);
    expect(failure.isFatal).toBe(false);
    expect(engine.progress).toBe(progress);
    expect(engine.getSnapshot().progress).toBe(progress);
    engine.setWpm(900);
    expect(engine.progress).toBe(progress);
    expect(engine.getSnapshot().progress).toBe(progress);
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });

  it("rejects reentrant engine commands while preparing a future word", () => {
    const onError = vi.fn();
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
      onError,
    });
    engine.load("hello world");
    engine.setOvpStrategy({
      calculate: (text) => {
        if (text === "world") {
          engine.pause();
        }
        return 0;
      },
    });
    engine.play();
    vi.advanceTimersByTime(60);
    expect(engine.state).toBe("ERROR");
    expect(onError.mock.calls[0]![0].cause).toBeInstanceOf(InvalidInputError);
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });

  it.each(["success", "failure"] as const)(
    "allows a queued pause after strategy %s without retaining the execution guard",
    async (outcome) => {
      const engine = new RsvpEngine({
        tokenizer: new TextTokenizer(),
        wpm: 1000,
      });
      engine.load("hello world");
      engine.play();
      vi.advanceTimersByTime(20);
      const failure = new Error("calculation failed");
      let pauseJob = Promise.resolve();
      const strategy: OvpStrategy = {
        calculate: () => {
          pauseJob = Promise.resolve().then(() => engine.pause());
          if (outcome === "failure") {
            throw failure;
          }
          return 4;
        },
      };
      if (outcome === "failure") {
        expect(() => engine.setOvpStrategy(strategy)).toThrow(
          expect.objectContaining({
            message: "Engine operation failed.",
            cause: failure,
          }),
        );
      } else {
        engine.setOvpStrategy(strategy);
      }
      expect(engine.state).toBe("PLAYING");
      await expect(pauseJob).resolves.toBeUndefined();
      expect(engine.state).toBe("PAUSED");
      expect(engine.currentIndex).toBe(0);
      expect(engine.getSnapshot().timing.remainingDurationMs).toBe(100);
      expect(vi.getTimerCount()).toBe(0);
      engine.destroy();
    },
  );

  it("permits subscriber commands after publishing the prepared OVP result", () => {
    const engine = new RsvpEngine({
      tokenizer: new TextTokenizer(),
      wpm: 1000,
    });
    engine.load("hello world");
    engine.play();
    const events: string[] = [];
    engine.subscribe((_snapshot, event) => {
      events.push(event);
      if (event === "ovpChanged") {
        engine.pause();
      }
    });
    expect(() => engine.setOvpStrategy(lastCharacter)).not.toThrow();
    expect(events).toEqual(["ovpChanged", "paused"]);
    expect(engine.state).toBe("PAUSED");
    expect(engine.currentItem?.ovpIndex).toBe(4);
    expect(vi.getTimerCount()).toBe(0);
    engine.destroy();
  });
});
