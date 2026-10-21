import { describe, expect, it, vi } from "vitest";

import { MissingTokenizerError, RsvpEngine } from "../index";

describe("explicit input loading", () => {
  it.each([
    { options: { wpm: 425 }, wpm: 425, msPerItem: 60_000 / 425 },
    { options: { msPerItem: 123.45 }, wpm: 60_000 / 123.45, msPerItem: 123.45 },
  ])(
    "initializes final configuration with one clock sample: $options",
    ({ options, wpm, msPerItem }) => {
      const now = vi.fn(() => 17);
      const calculate = vi.fn(() => 0);
      const timeDriver = { now, setTimeout: vi.fn(), clearTimeout: vi.fn() };
      const engine = new RsvpEngine({ ...options, timeDriver, ovpStrategy: { calculate } });

      expect(engine.getSnapshot()).toMatchObject({
        state: "IDLE",
        currentItem: null,
        totalItems: 0,
        wpm,
        msPerItem,
        timing: { totalDurationMs: 0, remainingDurationMs: 0, sampledAtMs: 17 },
      });
      expect(now).toHaveBeenCalledOnce();
      expect(calculate).not.toHaveBeenCalled();
      expect(timeDriver.setTimeout).not.toHaveBeenCalled();
      engine.destroy();
    },
  );

  it("rejects raw input without a tokenizer while preserving a usable pre-tokenized session", () => {
    const onError = vi.fn();
    const engine = new RsvpEngine({ onError });
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.loadTokens([{ value: "hello", ovpIndex: 0, durationMultiplier: 1 }]);
    engine.seek(0);
    const loaded = engine.getSnapshot();
    listener.mockClear();
    expect(() => engine.load("replacement")).toThrow(MissingTokenizerError);
    expect(engine.getSnapshot()).toBe(loaded);
    expect(listener).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    engine.play();
    expect(engine.state).toBe("PLAYING");
    engine.pause();
    expect(engine.state).toBe("PAUSED");
    engine.destroy();
  });
});
