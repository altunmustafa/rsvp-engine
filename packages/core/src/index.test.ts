import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineDestroyedError, RSVPEngine } from "./index";

describe("Public API integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("completes a full playback lifecycle successfully", () => {
    const engine = new RSVPEngine({
      data: "This is a complete test.",
      wpm: 600, // 100ms per token
    });

    const states: string[] = [];
    const presentedItems: string[] = [];

    engine.on("stateChange", ({ current }) => states.push(current));
    engine.on("itemChange", ({ item }) => presentedItems.push(item.value));

    // Initial state
    expect(engine.state).toBe("IDLE");
    expect(engine.totalItems).toBe(5);

    // Play
    engine.play();
    expect(engine.state).toBe("PLAYING");

    // Advance halfway
    vi.advanceTimersByTime(250);
    expect(presentedItems.length).toBeGreaterThanOrEqual(2);

    // Pause
    engine.pause();
    expect(engine.state).toBe("PAUSED");
    const itemCountAtPause = presentedItems.length;

    // Advance time while paused; no item should be presented.
    vi.advanceTimersByTime(200);
    expect(presentedItems.length).toBe(itemCountAtPause);

    // Resume
    engine.play();
    expect(engine.state).toBe("PLAYING");

    // Advance to end
    vi.advanceTimersByTime(1000);

    // Assert final state
    expect(engine.state).toBe("COMPLETED");
    expect(presentedItems).toEqual(["This", "is", "a", "complete", "test."]);

    // Assert state transitions
    expect(states).toEqual(["PLAYING", "PAUSED", "PLAYING", "COMPLETED"]);
  });

  it("handles seeking and navigation accurately", () => {
    const engine = new RSVPEngine({
      data: "one two three four",
      wpm: 600,
    });

    engine.play();
    engine.pause();

    // Seek to 2
    engine.seek(2);
    expect(engine.currentIndex).toBe(2);
    expect(engine.currentItem?.value).toBe("three");

    // Next
    engine.next();
    expect(engine.currentIndex).toBe(3);
    expect(engine.currentItem?.value).toBe("four");

    // Previous
    engine.previous();
    expect(engine.currentIndex).toBe(2);
    expect(engine.currentItem?.value).toBe("three");

    // Play from middle
    engine.play();
    vi.advanceTimersByTime(300);
    expect(engine.state).toBe("COMPLETED");
  });

  it("gracefully handles errors and destroys", () => {
    const engine = new RSVPEngine({ data: "hello", wpm: 300 });

    expect(() => {
      engine.pause(); // Invalid transition from IDLE
    }).not.toThrow(); // The engine itself catches and emits error

    expect(engine.state).toBe("IDLE");

    engine.destroy();

    expect(() => {
      engine.play();
    }).toThrow(EngineDestroyedError);
  });
});
