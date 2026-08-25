import { describe, expect, it } from "vitest";

import {
  EngineDestroyedError,
  IndexOutOfBoundsError,
  InvalidInputError,
  InvalidTransitionError,
} from "./errors";

describe("InvalidTransitionError behavior", () => {
  it("is an instance of Error", () => {
    const err = new InvalidTransitionError("IDLE", "pause");
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new InvalidTransitionError("IDLE", "pause");
    expect(err.name).toBe("InvalidTransitionError");
  });

  it("includes from and action in message", () => {
    const err = new InvalidTransitionError("IDLE", "pause");
    expect(err.message).toContain("IDLE");
    expect(err.message).toContain("pause");
  });

  it("exposes from and action properties", () => {
    const err = new InvalidTransitionError("PLAYING", "play");
    expect(err.from).toBe("PLAYING");
    expect(err.action).toBe("play");
  });

  it("has a stack trace", () => {
    const err = new InvalidTransitionError("IDLE", "stop");
    expect(err.stack).toBeDefined();
  });
});

describe("EngineDestroyedError", () => {
  it("is an instance of Error", () => {
    const err = new EngineDestroyedError();
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new EngineDestroyedError();
    expect(err.name).toBe("EngineDestroyedError");
  });

  it("has descriptive message", () => {
    const err = new EngineDestroyedError();
    expect(err.message).toContain("destroyed");
  });
});

describe("InvalidInputError", () => {
  it("is an instance of Error", () => {
    const err = new InvalidInputError("empty input");
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new InvalidInputError("test");
    expect(err.name).toBe("InvalidInputError");
  });

  it("preserves custom message", () => {
    const err = new InvalidInputError("Data cannot be null");
    expect(err.message).toBe("Data cannot be null");
  });
});

describe("IndexOutOfBoundsError", () => {
  it("is an instance of Error", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err.name).toBe("IndexOutOfBoundsError");
  });

  it("exposes index and totalItems", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err.index).toBe(10);
    expect(err.totalItems).toBe(5);
  });

  it("includes index and bounds in message", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err.message).toContain("10");
    expect(err.message).toContain("0..4");
  });
});
