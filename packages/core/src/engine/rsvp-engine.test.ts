import type { RsvpEngineOptions } from "./config";
import type { RsvpItem, RsvpSnapshot } from "./types";
import type { SchedulerStrategy } from "../scheduler/types";
import type { TokenizerStrategy } from "../tokenizer/types";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineDestroyedError, IndexOutOfBoundsError, InvalidInputError } from "../errors";

import { MAX_MS_PER_ITEM, MAX_WPM, MIN_MS_PER_ITEM, MIN_WPM } from "./config";
import { RsvpEngine } from "./rsvp-engine";

function createEngine(overrides: Partial<RsvpEngineOptions<string>> = {}): RsvpEngine<string> {
  return new RsvpEngine<string>({
    data: "Hello world foo bar baz",
    wpm: 300,
    ...overrides,
  });
}

function observePlayback(
  engine: RsvpEngine<string>,
  listener: (snapshot: RsvpSnapshot<string>) => void,
): () => void {
  let previous = engine.getSnapshot();
  return engine.subscribe(() => {
    const current = engine.getSnapshot();
    if (current !== previous) {
      previous = current;
      listener(current);
    }
  });
}

function observeStates(
  engine: RsvpEngine<string>,
  listener: (change: { previous: string; current: string }) => void,
): () => void {
  let previous = engine.state;
  return engine.subscribe(() => {
    if (engine.state !== previous) {
      const change = { previous, current: engine.state };
      previous = engine.state;
      listener(change);
    }
  });
}

function observeItems(
  engine: RsvpEngine<string>,
  listener: (item: { item: RsvpItem<string>; index: number; progress: number }) => void,
): () => void {
  let previous = engine.getSnapshot();
  return observePlayback(engine, (current) => {
    const changed =
      current.currentItem !== previous.currentItem || current.progress !== previous.progress;
    previous = current;
    if (changed && current.currentItem && current.progress > 0) {
      listener({
        item: current.currentItem,
        index: current.currentIndex,
        progress: current.progress,
      });
    }
  });
}

function observeErrors(
  engine: RsvpEngine<string>,
  listener: (payload: { error: Error }) => void,
): () => void {
  let previous = engine.getSnapshot().error;
  return engine.subscribe(() => {
    const error = engine.getSnapshot().error;
    if (error !== previous) {
      previous = error;
      if (error) {
        listener({ error });
      }
    }
  });
}

describe("RsvpEngine", () => {
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
      const engine = new RsvpEngine();
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
        tokenize: vi
          .fn()
          .mockReturnValue([{ value: "custom", ovpIndex: 0, durationMultiplier: 1.0 }]),
      };
      const engine = new RsvpEngine({ data: "anything", tokenizer: customTokenizer, wpm: 300 });
      expect(customTokenizer.tokenize).toHaveBeenCalledWith("anything");
      expect(engine.totalItems).toBe(1);
    });

    it("uses custom tokenizer (TokenizerStrategy class instance)", () => {
      const customStrategy: TokenizerStrategy<string> = {
        tokenize: vi
          .fn()
          .mockReturnValue([{ value: "from-class", ovpIndex: 2, durationMultiplier: 1.5 }]),
      };
      const engine = new RsvpEngine({ data: "sample", tokenizer: customStrategy, wpm: 300 });
      expect(customStrategy.tokenize).toHaveBeenCalledWith("sample");
      expect(engine.totalItems).toBe(1);
      expect(engine.currentItem).toMatchObject({ value: "from-class", ovpIndex: 2 });
    });

    it("uses custom scheduler", () => {
      const customScheduler: SchedulerStrategy = {
        schedule: vi.fn(),
        cancel: vi.fn(),
      };
      const engine = new RsvpEngine({
        data: "Hello world",
        scheduler: customScheduler,
        wpm: 300,
      });
      engine.play();
      expect(customScheduler.schedule).toHaveBeenCalled();
    });

    it("accepts no data and starts empty", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);
      expect(engine.currentItem).toBeNull();
    });
  });

  // ────── Data & Token Loading ──────

  describe("data and token loading", () => {
    it("load() tokenizes and loads new text into engine", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);

      engine.load("new text to read");
      expect(engine.totalItems).toBe(4);
      expect(engine.currentItem).toMatchObject({ value: "new" });
    });

    it("loadTokens() directly loads pre-tokenized items (e.g. from async or external tokenizers)", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      expect(engine.totalItems).toBe(0);

      engine.loadTokens([
        { value: "external-1", ovpIndex: 0, durationMultiplier: 1.0 },
        { value: "external-2", ovpIndex: 1, durationMultiplier: 1.5 },
      ]);

      expect(engine.totalItems).toBe(2);
      expect(engine.currentItem).toEqual({
        value: "external-1",
        index: 0,
        ovpIndex: 0,
        durationMultiplier: 1,
      });
    });

    it("load() throws EngineDestroyedError on destroyed engine", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      engine.destroy();
      expect(() => engine.load("text")).toThrow(EngineDestroyedError);
    });

    it("loadTokens() throws EngineDestroyedError on destroyed engine", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      engine.destroy();
      expect(() =>
        engine.loadTokens([{ value: "token", ovpIndex: 0, durationMultiplier: 1.0 }]),
      ).toThrow(EngineDestroyedError);
    });

    it("loads replacement data into IDLE from a stopped session", () => {
      const engine = createEngine();
      const changes: string[] = [];
      observeStates(engine, ({ current }) => changes.push(current));
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
        tokenize: () => [{ value: "bad", ovpIndex: 0, durationMultiplier: 0 }],
      };
      const engine = new RsvpEngine({ tokenizer });

      expect(() => engine.load("bad")).toThrow(InvalidInputError);
      expect(engine.state).toBe("IDLE");
    });
  });

  // ────── Playback Lifecycle ──────

  describe("playback lifecycle", () => {
    it("emits the first item immediately and keeps it as the current item", () => {
      const engine = createEngine({ data: "one two", wpm: 600 });
      const presentedItems: string[] = [];
      observeItems(engine, ({ item }) => presentedItems.push(item.value));

      engine.play();

      expect(presentedItems).toEqual(["one"]);
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentItem?.value).toBe("one");
      expect(engine.progress).toBe(0.5);
    });

    it("preserves the remaining display time across pause and resume", () => {
      const engine = createEngine({ data: "one. two", wpm: 600 });
      const presentedItems: string[] = [];
      observeItems(engine, ({ item }) => presentedItems.push(item.value));

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

    it("does not schedule another item when an subscriber pauses playback", () => {
      let scheduled: (() => void) | undefined;
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: (task) => {
          scheduled = task;
        },
      };
      const engine = createEngine({ scheduler });
      observeItems(engine, () => engine.pause());

      engine.play();

      expect(engine.state).toBe("PAUSED");
      expect(scheduled).toBeDefined();
      engine.play();
      expect(scheduled).toBeDefined();
    });

    it("does not schedule another item when an subscriber stops playback", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: vi.fn(),
      };
      const engine = createEngine({ scheduler });
      observeItems(engine, () => engine.stop());

      engine.play();

      expect(engine.state).toBe("STOPPED");
      expect(scheduler.schedule).toHaveBeenCalledOnce();
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
      observeStates(engine, (payload) => stateChanges.push(payload.current));

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
      observeStates(engine, (payload) => stateChanges.push(payload.current));

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

    it("notifies subscribers after seeks with correct items during playback", () => {
      const engine = createEngine({ data: "one two three", wpm: 600 });
      const itemValues: unknown[] = [];
      observeItems(engine, (payload) => itemValues.push(payload.item.value));

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

    it("seek() notifies subscribers after seek", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();

      const changes: unknown[] = [];
      observeItems(engine, ({ item }) => changes.push(item.value));

      engine.seek(2);
      expect(changes).toEqual(["foo"]);
    });

    it.for([NaN, Infinity, -Infinity, 0.5, -0.5, -1, 5])(
      "rejects seek(%s) without changing position or the paused remainder",
      (index) => {
        const engine = createEngine({ wpm: 600 });
        engine.play();
        vi.advanceTimersByTime(140);
        engine.pause();
        const before = engine.getSnapshot();
        const errors: Error[] = [];
        observeErrors(engine, ({ error }) => errors.push(error));
        const itemChange = vi.fn();
        const stateChange = vi.fn();
        observeItems(engine, itemChange);
        observeStates(engine, stateChange);

        expect(() => engine.seek(index)).not.toThrow();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBeInstanceOf(IndexOutOfBoundsError);
        expect(errors[0]).toMatchObject({ index, totalItems: before.totalItems });
        expect(engine.getSnapshot()).toEqual({ ...before, error: errors[0] });
        expect(itemChange).not.toHaveBeenCalled();
        expect(stateChange).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);

        engine.play();
        vi.advanceTimersByTime(59);
        expect(engine.currentIndex).toBe(1);
        vi.advanceTimersByTime(1);
        expect(engine.currentIndex).toBe(2);
        engine.destroy();
      },
    );

    it("preserves active playback when a seek index is invalid", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(40);
      const before = engine.getSnapshot();
      const errors: Error[] = [];
      observeErrors(engine, ({ error }) => errors.push(error));

      expect(() => engine.seek(NaN)).not.toThrow();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(IndexOutOfBoundsError);
      expect(engine.getSnapshot()).toEqual({ ...before, error: errors[0] });
      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(60);
      expect(engine.currentIndex).toBe(1);
      engine.destroy();
    });

    it("next() advances index in PAUSED state", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      engine.pause();
      const listener = vi.fn();
      engine.subscribe(listener);

      const idx = engine.currentIndex;
      engine.next();
      expect(engine.currentIndex).toBe(idx + 1);
      expect(listener).toHaveBeenCalledOnce();
    });

    it("previous() retreats index in PAUSED state", () => {
      const engine = createEngine({ wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(300); // advance several tokens
      engine.pause();
      const listener = vi.fn();
      engine.subscribe(listener);

      const idx = engine.currentIndex;
      engine.previous();
      expect(engine.currentIndex).toBe(idx - 1);
      expect(listener).toHaveBeenCalledOnce();
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

    it("next() in non-PAUSED state records an error", () => {
      const engine = createEngine({ wpm: 600 });
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.next(); // IDLE state
      expect(errors.length).toBe(1);
    });

    it("previous() in non-PAUSED state records an error", () => {
      const engine = createEngine({ wpm: 600 });
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.previous(); // IDLE state
      expect(errors.length).toBe(1);
    });
  });

  // ────── Speed Control ──────

  describe("speed control", () => {
    it.each([
      ...Array.from({ length: 37 }, (_, index) => 100 + index * 25),
      225.5,
      224.99999999999997,
      MIN_WPM,
      MAX_WPM,
    ])("preserves the exact WPM input %s in getters and snapshots", (wpm) => {
      const engine = createEngine({ wpm });
      expect(engine.wpm).toBe(wpm);
      expect(engine.getSnapshot().wpm).toBe(wpm);

      engine.setMsPerItem(500);
      engine.setWpm(wpm);
      expect(engine.wpm).toBe(wpm);
      expect(engine.msPerItem).toBe(60_000 / wpm);
      expect(engine.getSnapshot()).toMatchObject({ wpm, msPerItem: 60_000 / wpm });
    });

    it("preserves the last input unit even when the duration is unchanged", () => {
      const engine = createEngine({ wpm: 225 });
      const ms = engine.msPerItem;
      const original = engine.getSnapshot();

      engine.setMsPerItem(ms);
      expect(engine.msPerItem).toBe(ms);
      expect(engine.wpm).toBe(60_000 / ms);
      expect(engine.getSnapshot()).toMatchObject({ wpm: 60_000 / ms, msPerItem: ms });

      engine.setWpm(225);
      expect(engine.getSnapshot()).toEqual(original);
    });

    it.each([10, 66.66666666666667, 266.6666666666667, 60000])(
      "preserves direct duration %s and constructor precedence",
      (msPerItem) => {
        const engine = createEngine({ wpm: 225, msPerItem });
        expect(engine.getSnapshot()).toMatchObject({ msPerItem, wpm: 60_000 / msPerItem });
        engine.setWpm(425);
        engine.setMsPerItem(msPerItem);
        expect(engine.msPerItem).toBe(msPerItem);
        expect(engine.getSnapshot()).toMatchObject({ msPerItem, wpm: 60_000 / msPerItem });
      },
    );

    it.each(["setWpm", "setMsPerItem"] as const)(
      "%s rejects invalid inputs without changing speed and rejects use after destruction",
      (method) => {
        const engine = createEngine({ wpm: 225 });
        const snapshot = engine.getSnapshot();
        for (const value of [0, -1, 60001, Number.NaN, Infinity, -Infinity]) {
          expect(() => engine[method](value)).toThrow(InvalidInputError);
          expect(engine.getSnapshot()).toEqual({ ...snapshot, error: engine.getSnapshot().error });
        }
        engine.destroy();
        expect(() => engine[method](300)).toThrow(EngineDestroyedError);
      },
    );

    it("uses the new speed for the next item without replacing a paused remainder", () => {
      const engine = createEngine({ data: "one two three", wpm: 600 });
      engine.play();
      vi.advanceTimersByTime(40);
      engine.pause();
      engine.setWpm(225);
      engine.play();
      vi.advanceTimersByTime(59);
      expect(engine.currentIndex).toBe(0);
      vi.advanceTimersByTime(1);
      expect(engine.currentIndex).toBe(1);
      vi.advanceTimersByTime(265);
      expect(engine.currentIndex).toBe(1);
      vi.advanceTimersByTime(2);
      expect(engine.currentIndex).toBe(2);
    });

    it("setWpm() updates msPerItem and wpm", () => {
      const engine = createEngine({ wpm: 300 });
      engine.setWpm(600);
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
      const engine = new RsvpEngine({
        data: "Hello world",
        wpm: 300,
        scheduler: customScheduler,
      });
      engine.play();
      expect(customScheduler.schedule).toHaveBeenCalledWith(expect.any(Function), 200);

      engine.setWpm(600);
      expect(engine.msPerItem).toBe(100);
      expect(engine.wpm).toBe(600);
    });

    it("setWpm throws for invalid wpm (out of bounds or non-finite)", () => {
      const engine = createEngine();
      expect(() => engine.setWpm(0)).toThrow(InvalidInputError);
      expect(() => engine.setWpm(-1)).toThrow(InvalidInputError);
      expect(() => engine.setWpm(MIN_WPM - 1)).toThrow(InvalidInputError);
      expect(() => engine.setWpm(MAX_WPM + 1)).toThrow(InvalidInputError);
      expect(() => engine.setWpm(Number.NaN)).toThrow(InvalidInputError);
      expect(() => engine.setWpm(Number.POSITIVE_INFINITY)).toThrow(InvalidInputError);
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

  describe("subscriptions", () => {
    it("subscribers can derive previous and current states", () => {
      const engine = createEngine({ wpm: 600 });
      const changes: { previous: string; current: string }[] = [];
      observeStates(engine, (p) => changes.push({ previous: p.previous, current: p.current }));

      engine.play();
      expect(changes[0]).toEqual({ previous: "IDLE", current: "PLAYING" });
    });

    it("subscribers observe presented items", () => {
      const engine = createEngine({ data: "hello world", wpm: 600 });
      const items: string[] = [];
      observeItems(engine, (p) => items.push(p.item.value as string));

      engine.play();
      vi.advanceTimersByTime(100);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0]).toBe("hello");
    });

    it("subscribers observe item index and progress once per presentation", () => {
      const engine = createEngine({ data: "hello world", wpm: 600 });
      const changes: { index: number; progress: number }[] = [];
      observeItems(engine, ({ index, progress }) => changes.push({ index, progress }));

      engine.play();
      vi.advanceTimersByTime(100);

      expect(changes).toEqual([
        { index: 0, progress: 0.5 },
        { index: 1, progress: 1 },
      ]);
    });

    it("emits complete after the final item finishes displaying", () => {
      const engine = createEngine({ data: "one", wpm: 600 });
      const completed = vi.fn();
      engine.subscribe(() => {
        if (engine.state === "COMPLETED") {
          completed();
        }
      });

      engine.play();
      expect(completed).not.toHaveBeenCalled();
      vi.advanceTimersByTime(100);

      expect(completed).toHaveBeenCalledOnce();
      expect(engine.currentIndex).toBe(0);
      expect(engine.currentItem?.value).toBe("one");
      expect(engine.progress).toBe(1);
    });

    it("unsubscribe removes the callback", () => {
      const engine = createEngine({ wpm: 600 });
      const changes: string[] = [];
      const unsub = observeStates(engine, (p) => changes.push(p.current));

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
      const engine = new RsvpEngine({
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
      expect(() => engine.setWpm(300)).toThrow(EngineDestroyedError);
      expect(() => engine.setMsPerItem(200)).toThrow(EngineDestroyedError);
      expect(() => observeItems(engine, () => "")).toThrow(EngineDestroyedError);
      expect(() => engine.getSnapshot()).not.toThrow();
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
    it("play() with no data records a non-fatal error", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("empty string data produces no tokens, play records an error", () => {
      const engine = new RsvpEngine({ data: "", wpm: 300 });
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("whitespace-only data produces no tokens, play records an error", () => {
      const engine = new RsvpEngine({ data: "   ", wpm: 300 });
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.play();
      expect(errors.length).toBe(1);
    });

    it("invalid state transition records an observable error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.pause(); // IDLE -> pause is invalid
      expect(errors.length).toBe(1);
    });

    it("seek() in PLAYING state reports an error without corrupting playback", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.play();
      engine.seek(1); // PLAYING -> seek is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("PLAYING");
    });

    it("reset() in IDLE state causes transition error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

      engine.reset(); // IDLE -> reset is invalid
      expect(errors.length).toBe(1);
      expect(engine.state).toBe("IDLE");
    });

    it("stop() in IDLE preserves the ready snapshot without an error", () => {
      const engine = createEngine();
      const initial = engine.getSnapshot();

      engine.stop();
      expect(engine.getSnapshot()).toBe(initial);
      expect(engine.getSnapshot().error).toBeNull();
      engine.destroy();
    });

    it("play() in PLAYING state causes transition error", () => {
      const engine = createEngine();
      const errors: Error[] = [];
      observeErrors(engine, (p) => errors.push(p.error));

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
        () => new RsvpEngine({ data: "hello", tokenizer: throwingTokenizer, wpm: 300 }),
      ).toThrow("Sync tokenizer error");
    });

    it("publishes fatal scheduler failure without an intermediate PLAYING state", () => {
      const scheduler: SchedulerStrategy = {
        cancel: vi.fn(),
        schedule: vi.fn(() => {
          throw new Error("Scheduler failed");
        }),
      };
      const engine = createEngine({ scheduler });
      const changes: { current: string; previous: string }[] = [];
      observeStates(engine, (change) => changes.push(change));

      engine.play();

      expect(engine.state).toBe("ERROR");
      expect(changes).toEqual([{ previous: "IDLE", current: "ERROR" }]);
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
      observeErrors(engine, ({ error }) => errors.push(error));

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
      const engine = new RsvpEngine({ wpm: 300 });

      expect(() => engine.loadTokens(null as never)).toThrow(InvalidInputError);
      expect(() => engine.loadTokens([null] as never)).toThrow(InvalidInputError);
      expect(() =>
        engine.loadTokens([{ value: "bad", ovpIndex: 0, durationMultiplier: 0 }]),
      ).toThrow(InvalidInputError);
      expect(() =>
        engine.loadTokens([{ value: "bad", ovpIndex: -1, durationMultiplier: 1 }]),
      ).toThrow(InvalidInputError);
      expect(() =>
        engine.loadTokens([{ value: "bad", ovpIndex: 4, durationMultiplier: 1 }]),
      ).toThrow(InvalidInputError);
      expect(engine.state).toBe("IDLE");
      expect(engine.totalItems).toBe(0);
    });
  });

  // ────── Snapshot ──────

  describe("snapshot", () => {
    it("returns a frozen readonly copy", () => {
      const engine = createEngine({ wpm: 300 });
      const snap = engine.getSnapshot();

      expect(Object.isFrozen(snap)).toBe(true);
      expect(snap.state).toBe("IDLE");
      expect(snap.wpm).toBe(300);
      expect(snap.totalItems).toBe(5);
      expect(snap.currentIndex).toBe(0);
      expect(snap.progress).toBe(0);
    });

    it("snapshot is immutable", () => {
      const engine = createEngine();
      const snap = engine.getSnapshot();

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
      const engine = new RsvpEngine({ wpm: 300 });
      expect(engine.currentItem).toBeNull();
    });

    it("progress is 0 when no tokens", () => {
      const engine = new RsvpEngine({ wpm: 300 });
      expect(engine.progress).toBe(0);
    });
  });
});
