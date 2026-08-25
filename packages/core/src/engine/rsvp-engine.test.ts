import type { RSVPEngineOptions } from "./config";
import type { SchedulerStrategy } from "../scheduler/types";
import type { TokenizerStrategy } from "../tokenizer/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineDestroyedError, InvalidInputError } from "../errors";

import { MAX_MS_PER_ITEM, MAX_WPM, MIN_MS_PER_ITEM, MIN_WPM } from "./config";
import { RSVPEngine } from "./rsvp-engine";

function createEngine(overrides: Partial<RSVPEngineOptions<string>> = {}): RSVPEngine<string> {
  return new RSVPEngine<string>({
    data: "Hello world foo bar baz",
    wpm: 300,
    ...overrides,
  });
}

describe("RSVPEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ────── Construction & Configuration ──────

  describe("construction & configuration", () => {
    it("starts in IDLE state with default wpm", () => {
      const engine = new RSVPEngine();
      expect(engine.state).toBe("IDLE");
      expect(engine.wpm).toBe(300);
    });

    it("calculates msPerItem from wpm", () => {
      const engine = createEngine({ wpm: 600 });
      expect(engine.msPerItem).toBe(100);
    });

    it("uses msPerItem directly when provided", () => {
      const engine = createEngine({ msPerItem: 500 });
      expect(engine.msPerItem).toBe(500);
      expect(engine.wpm).toBe(120);
    });

    it("msPerItem takes precedence over wpm", () => {
      const engine = createEngine({ wpm: 600, msPerItem: 500 });
      expect(engine.msPerItem).toBe(500);
    });

    it("throws for wpm out of bounds or non-finite", () => {
      expect(() => createEngine({ wpm: 0 })).toThrow(InvalidInputError);
      expect(() => createEngine({ wpm: -1 })).toThrow(InvalidInputError);
      expect(() => createEngine({ wpm: MIN_WPM - 1 })).toThrow(InvalidInputError);
      expect(() => createEngine({ wpm: MAX_WPM + 1 })).toThrow(InvalidInputError);
      expect(() => createEngine({ wpm: Number.NaN })).toThrow(InvalidInputError);
      expect(() => createEngine({ wpm: Number.POSITIVE_INFINITY })).toThrow(InvalidInputError);
    });

    it("accepts valid boundary wpm values", () => {
      expect(createEngine({ wpm: MIN_WPM }).wpm).toBe(MIN_WPM);
      expect(createEngine({ wpm: MAX_WPM }).wpm).toBe(MAX_WPM);
    });

    it("throws for msPerItem out of bounds or non-finite", () => {
      expect(() => createEngine({ msPerItem: 0 })).toThrow(InvalidInputError);
      expect(() => createEngine({ msPerItem: -100 })).toThrow(InvalidInputError);
      expect(() => createEngine({ msPerItem: MIN_MS_PER_ITEM - 1 })).toThrow(InvalidInputError);
      expect(() => createEngine({ msPerItem: MAX_MS_PER_ITEM + 1 })).toThrow(InvalidInputError);
      expect(() => createEngine({ msPerItem: Number.NaN })).toThrow(InvalidInputError);
      expect(() => createEngine({ msPerItem: Number.POSITIVE_INFINITY })).toThrow(
        InvalidInputError,
      );
    });

    it("accepts valid boundary msPerItem values", () => {
      expect(createEngine({ msPerItem: MIN_MS_PER_ITEM }).msPerItem).toBe(MIN_MS_PER_ITEM);
      expect(createEngine({ msPerItem: MAX_MS_PER_ITEM }).msPerItem).toBe(MAX_MS_PER_ITEM);
    });

    it("uses custom tokenizer (TokenizerStrategy)", () => {
      const customTokenizer: TokenizerStrategy<string> = {
        tokenize: vi.fn().mockReturnValue([{ value: "custom", ovpIndex: 0, delayMultiplier: 1.0 }]),
      };
      const engine = new RSVPEngine({ data: "anything", tokenizer: customTokenizer, wpm: 300 });
      expect(customTokenizer.tokenize).toHaveBeenCalledWith("anything");
      expect(engine.totalItems).toBe(1);
    });

    it("uses custom tokenizer (TokenizerStrategy class instance)", () => {
      const customStrategy: TokenizerStrategy<string> = {
        tokenize: vi
          .fn()
          .mockReturnValue([{ value: "from-class", ovpIndex: 2, delayMultiplier: 1.5 }]),
      };
      const engine = new RSVPEngine({ data: "sample", tokenizer: customStrategy, wpm: 300 });
      expect(customStrategy.tokenize).toHaveBeenCalledWith("sample");
      expect(engine.totalItems).toBe(1);
      expect(engine.currentItem).toMatchObject({ value: "from-class", ovpIndex: 2 });
    });

    it("uses custom scheduler", () => {
      const customScheduler: SchedulerStrategy = {
        schedule: vi.fn(),
        cancel: vi.fn(),
      };
      const engine = new RSVPEngine({
        data: "Hello world",
        scheduler: customScheduler,
        wpm: 300,
      });
      engine.play();
      expect(customScheduler.schedule).toHaveBeenCalled();
    });

    it("accepts no data and starts empty", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);
      expect(engine.currentItem).toBeNull();
    });
  });

  // ────── Data & Token Loading ──────

  describe("data and token loading", () => {
    it("load() tokenizes and loads new text into engine", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);

      engine.load("new text to read");
      expect(engine.totalItems).toBe(4);
      expect(engine.currentItem).toMatchObject({ value: "new" });
    });

    it("loadTokens() directly loads pre-tokenized items (e.g. from async or external tokenizers)", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);

      engine.loadTokens([
        { value: "external-1", ovpIndex: 0, delayMultiplier: 1.0 },
        { value: "external-2", ovpIndex: 1, delayMultiplier: 1.5 },
      ]);

      expect(engine.totalItems).toBe(2);
      expect(engine.currentItem).toMatchObject({ value: "external-1", ovpIndex: 0 });
    });

    it("load() throws EngineDestroyedError on destroyed engine", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      engine.destroy();
      expect(() => engine.load("text")).toThrow(EngineDestroyedError);
    });

    it("loadTokens() throws EngineDestroyedError on destroyed engine", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      engine.destroy();
      expect(() =>
        engine.loadTokens([{ value: "token", ovpIndex: 0, delayMultiplier: 1.0 }]),
      ).toThrow(EngineDestroyedError);
    });

    it("loads replacement data into IDLE from a stopped session", () => {
      const engine = createEngine();
      const changes: string[] = [];
      engine.on("stateChange", ({ current }) => changes.push(current));
      engine.play();
      engine.stop();

      engine.load("replacement text");

      expect(engine.state).toBe("IDLE");
      expect(engine.currentItem?.value).toBe("replacement");
      expect(changes.at(-1)).toBe("IDLE");
    });

    it("rejects loading while playing without changing playback state", () => {
      const engine = createEngine();
      engine.play();

      expect(() => engine.load("replacement")).toThrow(InvalidInputError);
      expect(engine.state).toBe("PLAYING");
    });

    it("preserves invalid tokenizer output as an input error", () => {
      const tokenizer: TokenizerStrategy<string> = {
        tokenize: () => [{ value: "bad", ovpIndex: 0, delayMultiplier: 0 }],
      };
      const engine = new RSVPEngine({ tokenizer });

      expect(() => engine.load("bad")).toThrow(InvalidInputError);
      expect(engine.state).toBe("IDLE");
    });
  });

  // ────── Playback Lifecycle ──────

  describe("playback lifecycle", () => {
    it("emits the first item immediately and keeps it as the current item", () => {
      const engine = createEngine({ data: "one two", wpm: 600 });
      const presentedItems: string[] = [];
      engine.on("itemChange", ({ item }) => presentedItems.push(item.value));

      engine.play();

      expect(presentedItems).toEqual(["one"]);
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentItem?.value).toBe("one");
      expect(engine.progress).toBe(0.5);
    });

    it("preserves the remaining display time across pause and resume", () => {
      const engine = createEngine({ data: "one. two", wpm: 600 });
      const presentedItems: string[] = [];
      engine.on("itemChange", ({ item }) => presentedItems.push(item.value));

      engine.play();
      vi.advanceTimersByTime(50);
      engine.pause();
      vi.advanceTimersByTime(500);
      engine.play();
      vi.advanceTimersByTime(149);
      expect(presentedItems).toEqual(["one."]);

      vi.advanceTimersByTime(1);
      expect(presentedItems).toEqual(["one.", "two"]);
      expect(engine.currentItem?.value).toBe("two");
    });

    it("does not schedule another item when an itemChange listener pauses playback", () => {
      let scheduled: (() => void) | undefined;
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: (task) => {
          scheduled = task;
        },
      };
      const engine = createEngine({ scheduler });
      engine.on("itemChange", () => engine.pause());

      engine.play();

      expect(engine.state).toBe("PAUSED");
      expect(scheduled).toBeUndefined();
      engine.play();
      expect(scheduled).toBeDefined();
    });

    it("does not schedule another item when an itemChange listener stops playback", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: vi.fn(),
      };
      const engine = createEngine({ scheduler });
      engine.on("itemChange", () => engine.stop());

      engine.play();

      expect(engine.state).toBe("STOPPED");
      expect(scheduler.schedule).not.toHaveBeenCalled();
    });

    it("ignores stale scheduler callbacks after playback leaves PLAYING", () => {
      let scheduled: (() => void) | undefined;
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: (task) => {
          scheduled = task;
        },
      };
      const engine = createEngine({ scheduler });
      engine.play();
      engine.pause();

      scheduled?.();

      expect(engine.state).toBe("PAUSED");
      expect(engine.currentIndex).toBe(0);
    });

    it("play() transitions to PLAYING and starts presenting items", () => {
      const engine = createEngine({ wpm: 600 }); // 100ms per item
      const stateChanges: string[] = [];
      engine.on("stateChange", (payload) => stateChanges.push(payload.current));

      engine.play();
      expect(engine.state).toBe("PLAYING");
      expect(stateChanges).toContain("PLAYING");
    });

    it("pause() transitions to PAUSED and preserves index", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();

      vi.advanceTimersByTime(250); // ~2-3 item changes
      const indexBeforePause = engine.currentIndex;

      engine.pause();
      expect(engine.state).toBe("PAUSED");
      // Index should not advance after pausing
      vi.advanceTimersByTime(500);
      expect(engine.currentIndex).toBe(indexBeforePause);
    });

    it("play() from PAUSED resumes from preserved index", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(200);
      engine.pause();

      const indexBeforeResume = engine.currentIndex;

      engine.play();
      expect(engine.state).toBe("PLAYING");
      // Should not have reset to 0
      expect(engine.currentIndex).toBe(indexBeforeResume);
    });

    it("stop() resets index to 0", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(200);

      engine.stop();
      expect(engine.state).toBe("STOPPED");
      expect(engine.currentIndex).toBe(0);
    });

    it("play() from STOPPED starts from beginning", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(200);
      engine.stop();

      engine.play();
      expect(engine.state).toBe("PLAYING");
      expect(engine.currentIndex).toBe(0);
    });

    it("completes naturally after all tokens are presented", () => {
      const engine = createEngine({ data: "one two", wpm: 600 }); // 2 tokens, 100ms each
      const stateChanges: string[] = [];
      engine.on("stateChange", (payload) => stateChanges.push(payload.current));

      engine.play();
      vi.advanceTimersByTime(200);

      expect(engine.state).toBe("COMPLETED");
      expect(stateChanges).toContain("COMPLETED");
    });

    it("play() from COMPLETED restarts from beginning", () => {
      const engine = createEngine({ data: "one two", wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(200);
      expect(engine.state).toBe("COMPLETED");

      engine.play();
      expect(engine.state).toBe("PLAYING");
      expect(engine.currentIndex).toBe(0);
    });

    it("emits itemChange events with correct items during playback", () => {
      const engine = createEngine({ data: "one two three", wpm: 600 });
      const itemValues: unknown[] = [];
      engine.on("itemChange", (payload) => itemValues.push(payload.item.value));

      engine.play();
      vi.advanceTimersByTime(300);

      expect(itemValues).toEqual(["one", "two", "three"]);
    });
  });

  // ────── Navigation ──────

  describe("navigation", () => {
    it("seek() sets index and transitions to PAUSED", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(100);
      engine.pause();

      engine.seek(3);
      expect(engine.currentIndex).toBe(3);
      expect(engine.state).toBe("PAUSED");
    });

    it("seek() from STOPPED transitions to PAUSED", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.stop();

      engine.seek(2);
      expect(engine.currentIndex).toBe(2);
      expect(engine.state).toBe("PAUSED");
    });

    it("seek() from COMPLETED transitions to PAUSED", () => {
      const engine = createEngine({ data: "one two", wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(300);
      expect(engine.state).toBe("COMPLETED");

      engine.seek(0);
      expect(engine.currentIndex).toBe(0);
      expect(engine.state).toBe("PAUSED");
    });

    it("seek() emits itemChange event", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();

      const changes: { item: unknown; reason: string }[] = [];
      engine.on("itemChange", ({ item, reason }) => changes.push({ item: item.value, reason }));

      engine.seek(2);
      expect(changes).toEqual([{ item: "foo", reason: "seek" }]);
    });

    it("seek() out of bounds emits a non-fatal error", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();

      const errors: Error[] = [];
      engine.on("error", (payload) => errors.push(payload.error));

      engine.seek(100);
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("PAUSED");
    });

    it("seek() with negative index triggers ERROR", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();

      const errors: Error[] = [];
      engine.on("error", (payload) => errors.push(payload.error));

      engine.seek(-1);
      expect(errors.length).toBe(1);
    });

    it("next() advances index in PAUSED state", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();
      const reasons: string[] = [];
      engine.on("itemChange", ({ reason }) => reasons.push(reason));

      const idx = engine.currentIndex;
      engine.next();
      expect(engine.currentIndex).toBe(idx + 1);
      expect(reasons).toEqual(["next"]);
    });

    it("previous() retreats index in PAUSED state", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(300); // advance several tokens
      engine.pause();
      const reasons: string[] = [];
      engine.on("itemChange", ({ reason }) => reasons.push(reason));

      const idx = engine.currentIndex;
      engine.previous();
      expect(engine.currentIndex).toBe(idx - 1);
      expect(reasons).toEqual(["previous"]);
    });

    it("next() at last token does not exceed bounds", () => {
      const engine = createEngine({ data: "one two", wpm: 600 });
      engine.play();
      engine.pause();

      engine.seek(1); // last token
      engine.next();
      expect(engine.currentIndex).toBe(1); // stays at last
    });

    it("previous() at first token does not go below 0", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();

      engine.seek(0);
      engine.previous();
      expect(engine.currentIndex).toBe(0);
    });

    it("next() in non-PAUSED state emits error", () => {
      const engine = createEngine({ wpm: 600 });
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.next(); // IDLE state
      expect(errors.length).toBe(1);
    });

    it("previous() in non-PAUSED state emits error", () => {
      const engine = createEngine({ wpm: 600 });
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.previous(); // IDLE state
      expect(errors.length).toBe(1);
    });
  });

  // ────── Speed Control ──────

  describe("speed control", () => {
    it("setSpeed() updates msPerItem and wpm", () => {
      const engine = createEngine({ wpm: 300 });
      engine.setSpeed(600);
      expect(engine.wpm).toBe(600);
      expect(engine.msPerItem).toBe(100);
    });

    it("setMsPerItem() updates msPerItem and wpm", () => {
      const engine = createEngine({ wpm: 300 });
      engine.setMsPerItem(100);
      expect(engine.msPerItem).toBe(100);
      expect(engine.wpm).toBe(600);
    });

    it("speed change during playback takes effect", () => {
      const customScheduler: SchedulerStrategy = {
        schedule: vi.fn(),
        cancel: vi.fn(),
      };
      const engine = new RSVPEngine({
        data: "Hello world",
        wpm: 300,
        scheduler: customScheduler,
      });
      engine.play();
      expect(customScheduler.schedule).toHaveBeenCalledWith(expect.any(Function), 200);

      engine.setSpeed(600);
      expect(engine.msPerItem).toBe(100);
      expect(engine.wpm).toBe(600);
    });

    it("setSpeed throws for invalid wpm (out of bounds or non-finite)", () => {
      const engine = createEngine();
      expect(() => engine.setSpeed(0)).toThrow(InvalidInputError);
      expect(() => engine.setSpeed(-1)).toThrow(InvalidInputError);
      expect(() => engine.setSpeed(MIN_WPM - 1)).toThrow(InvalidInputError);
      expect(() => engine.setSpeed(MAX_WPM + 1)).toThrow(InvalidInputError);
      expect(() => engine.setSpeed(Number.NaN)).toThrow(InvalidInputError);
      expect(() => engine.setSpeed(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
    });

    it("setMsPerItem throws for invalid ms (out of bounds or non-finite)", () => {
      const engine = createEngine();
      expect(() => engine.setMsPerItem(0)).toThrow(InvalidInputError);
      expect(() => engine.setMsPerItem(-1)).toThrow(InvalidInputError);
      expect(() => engine.setMsPerItem(MIN_MS_PER_ITEM - 1)).toThrow(InvalidInputError);
      expect(() => engine.setMsPerItem(MAX_MS_PER_ITEM + 1)).toThrow(InvalidInputError);
      expect(() => engine.setMsPerItem(Number.NaN)).toThrow(InvalidInputError);
      expect(() => engine.setMsPerItem(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
    });
  });

  // ────── Events ──────

  describe("events", () => {
    it("stateChange emits with previous and current state", () => {
      const engine = createEngine({ wpm: 600 });
      const changes: { previous: string; current: string }[] = [];
      engine.on("stateChange", (p) => changes.push({ previous: p.previous, current: p.current }));

      engine.play();
      expect(changes[0]).toEqual({ previous: "IDLE", current: "PLAYING" });
    });

    it("itemChange emits correct item payload", () => {
      const engine = createEngine({ data: "hello world", wpm: 600 });
      const items: string[] = [];
      engine.on("itemChange", (p) => items.push(p.item.value as string));

      engine.play();
      vi.advanceTimersByTime(100);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]).toBe("hello");
    });

    it("itemChange emits one complete playback payload per presented item", () => {
      const engine = createEngine({ data: "hello world", wpm: 600 });
      const changes: { index: number; progress: number; reason: string }[] = [];
      engine.on("itemChange", ({ index, progress, reason }) =>
        changes.push({ index, progress, reason }),
      );

      engine.play();
      vi.advanceTimersByTime(100);

      expect(changes).toEqual([
        { index: 0, progress: 0.5, reason: "playback" },
        { index: 1, progress: 1, reason: "playback" },
      ]);
    });

    it("emits complete after the final item finishes displaying", () => {
      const engine = createEngine({ data: "one", wpm: 600 });
      const completed = vi.fn();
      engine.on("complete", completed);

      engine.play();
      expect(completed).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      expect(completed).toHaveBeenCalledOnce();
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentItem?.value).toBe("one");
      expect(engine.progress).toBe(1);
    });

    it("on() returns UnsubscribeFn that works", () => {
      const engine = createEngine({ wpm: 600 });
      const changes: string[] = [];
      const unsub = engine.on("stateChange", (p) => changes.push(p.current));

      engine.play();
      expect(changes.length).toBe(1);

      unsub();
      engine.pause();
      // No new state change should be captured
      expect(changes.length).toBe(1);
    });
  });

  // ────── Destroy ──────

  describe("destroy", () => {
    it("stops scheduler and clears listeners", () => {
      const customScheduler: SchedulerStrategy = {
        schedule: vi.fn(),
        cancel: vi.fn(),
      };
      const engine = new RSVPEngine({
        data: "Hello world",
        wpm: 300,
        scheduler: customScheduler,
      });
      engine.play();
      engine.destroy();
      expect(customScheduler.cancel).toHaveBeenCalled();
    });

    it("throws EngineDestroyedError on any method after destroy", () => {
      const engine = createEngine();
      engine.destroy();

      expect(() => engine.play()).toThrow(EngineDestroyedError);
      expect(() => engine.pause()).toThrow(EngineDestroyedError);
      expect(() => engine.stop()).toThrow(EngineDestroyedError);
      expect(() => engine.seek(0)).toThrow(EngineDestroyedError);
      expect(() => engine.next()).toThrow(EngineDestroyedError);
      expect(() => engine.previous()).toThrow(EngineDestroyedError);
      expect(() => engine.reset()).toThrow(EngineDestroyedError);
      expect(() => engine.setSpeed(300)).toThrow(EngineDestroyedError);
      expect(() => engine.setMsPerItem(200)).toThrow(EngineDestroyedError);
      expect(() => engine.on("itemChange", () => "")).toThrow(EngineDestroyedError);
      expect(() => engine.snapshot()).toThrow(EngineDestroyedError);
      expect(() => engine.load("test")).toThrow(EngineDestroyedError);
      expect(() => engine.loadTokens([])).toThrow(EngineDestroyedError);
    });

    it("double destroy is idempotent", () => {
      const engine = createEngine();
      engine.destroy();
      expect(() => engine.destroy()).not.toThrow();
    });
  });

  // ────── Error Handling ──────

  describe("error handling", () => {
    it("play() with no data emits a non-fatal error", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("empty string data produces no tokens, play emits error", () => {
      const engine = new RSVPEngine({ data: "", wpm: 300 });
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("whitespace-only data produces no tokens, play emits error", () => {
      const engine = new RSVPEngine({ data: "   ", wpm: 300 });
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
    });

    it("invalid state transition emits error event", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.pause(); // IDLE -> pause is invalid
      expect(errors.length).toBe(1);
    });

    it("seek() in PLAYING state reports an error without corrupting playback", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.play();
      engine.seek(1); // PLAYING -> seek is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("PLAYING");
    });

    it("reset() in IDLE state causes transition error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.reset(); // IDLE -> reset is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("stop() in IDLE state causes transition error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.stop(); // IDLE -> stop is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("play() in PLAYING state causes transition error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      engine.on("error", (p) => errors.push(p.error));

      engine.play();
      engine.play(); // PLAYING -> play is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("PLAYING");
    });

    it("sync throwing tokenizer remains observable during construction", () => {
      const throwingTokenizer: TokenizerStrategy<unknown> = {
        tokenize: () => {
          throw new Error("Sync tokenizer error");
        },
      };
      expect(
        () => new RSVPEngine({ data: "hello", tokenizer: throwingTokenizer, wpm: 300 }),
      ).toThrow("Sync tokenizer error");
    });

    it("uses the actual previous state for fatal scheduler errors", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: vi.fn(() => {
          throw new Error("Scheduler failed");
        }),
      };
      const engine = createEngine({ scheduler });
      const changes: { current: string; previous: string }[] = [];
      engine.on("stateChange", (change) => changes.push(change));

      engine.play();

      expect(engine.state).toBe("ERROR");
      expect(changes.at(-1)).toEqual({ previous: "PLAYING", current: "ERROR" });
    });

    it("normalizes non-Error scheduler failures", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: () => {
          throw "Scheduler failed";
        },
      };
      const engine = createEngine({ scheduler });
      const errors: Error[] = [];
      engine.on("error", ({ error }) => errors.push(error));

      engine.play();

      expect(errors[0]).toBeInstanceOf(Error);
      expect(errors[0]?.message).toBe("Scheduler failed");
    });

    it("reset() from ERROR state restores IDLE state and resets index", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: vi.fn(() => {
          throw new Error("Scheduler failed");
        }),
      };
      const engine = createEngine({ scheduler });
      engine.play();
      expect(engine.state).toBe("ERROR");

      engine.reset();
      expect(engine.state).toBe("IDLE");
      expect(engine.currentIndex).toBe(0);
      expect(engine.totalItems).toBe(0);
    });

    it("validates pre-tokenized items without changing state", () => {
      const engine = new RSVPEngine({ wpm: 300 });

      expect(() => engine.loadTokens(null as never)).toThrow(InvalidInputError);
      expect(() => engine.loadTokens([null] as never)).toThrow(InvalidInputError);
      expect(() => engine.loadTokens([{ value: "bad", ovpIndex: 0, delayMultiplier: 0 }])).toThrow(
        InvalidInputError,
      );
      expect(() => engine.loadTokens([{ value: "bad", ovpIndex: -1, delayMultiplier: 1 }])).toThrow(
        InvalidInputError,
      );
      expect(() => engine.loadTokens([{ value: "bad", ovpIndex: 4, delayMultiplier: 1 }])).toThrow(
        InvalidInputError,
      );
      expect(engine.state).toBe("IDLE");
      expect(engine.totalItems).toBe(0);
    });
  });

  // ────── Snapshot ──────

  describe("snapshot", () => {
    it("returns a frozen readonly copy", () => {
      const engine = createEngine({ wpm: 300 });
      const snap = engine.snapshot();

      expect(Object.isFrozen(snap)).toBe(true);
      expect(snap.state).toBe("IDLE");
      expect(snap.wpm).toBe(300);
      expect(snap.totalItems).toBe(5);
      expect(snap.currentIndex).toBe(0);
      expect(snap.progress).toBe(0);
    });

    it("snapshot is immutable", () => {
      const engine = createEngine();
      const snap = engine.snapshot();

      expect(() => {
        // @ts-expect-error — testing runtime immutability
        snap.state = "PLAYING";
      }).toThrow();
    });
  });

  // ────── Progress & Getters ──────

  describe("progress & getters", () => {
    it("progress starts at 0", () => {
      const engine = createEngine();
      expect(engine.progress).toBe(0);
    });

    it("progress increases during playback", () => {
      const engine = createEngine({ data: "one two three four five", wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(300);
      expect(engine.progress).toBeGreaterThan(0);
    });

    it("totalItems returns correct count", () => {
      const engine = createEngine({ data: "one two three" });
      expect(engine.totalItems).toBe(3);
    });

    it("currentItem returns correct item", () => {
      const engine = createEngine({ data: "hello world" });
      expect(engine.currentItem).not.toBeNull();
      expect(engine.currentItem?.value).toBe("hello");
    });

    it("currentItem returns null when no tokens", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      expect(engine.currentItem).toBeNull();
    });

    it("progress is 0 when no tokens", () => {
      const engine = new RSVPEngine({ wpm: 300 });
      expect(engine.progress).toBe(0);
    });
  });
});
