import { describe, expect, it } from "vitest";

import {
  EngineDestroyedError,
  EngineError,
  IndexOutOfBoundsError,
  InvalidInputError,
  InvalidTransitionError,
  ItemSelectionError,
  ListenerError,
} from "./errors";

describe("InvalidTransitionError behavior", () => {
  it("is an instance of Error", () => {
    const err = new InvalidTransitionError("IDLE", "pause");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngineError);
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

  it("preserves custom context and a stack trace", () => {
    const cause = new Error("Command rejected");
    const err = new InvalidTransitionError("IDLE", "stop", {
      message: "Cannot stop this session.",
      cause,
    });
    expect(err.stack).toBeDefined();
    expect(err.message).toBe("Cannot stop this session.");
    expect(err.cause).toBe(cause);
    expect(err.isFatal).toBe(false);
  });
});

describe("EngineDestroyedError", () => {
  it("is an instance of Error", () => {
    const err = new EngineDestroyedError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngineError);
  });

  it("preserves custom context and its error name", () => {
    const cause = new Error("Owner disposed");
    const err = new EngineDestroyedError({ message: "Session ended.", cause });
    expect(err.name).toBe("EngineDestroyedError");
    expect(err.message).toBe("Session ended.");
    expect(err.cause).toBe(cause);
    expect(err.isFatal).toBe(false);
  });

  it("has descriptive message", () => {
    const err = new EngineDestroyedError();
    expect(err.message).toContain("destroyed");
  });
});

describe("InvalidInputError", () => {
  it("is nonfatal and preserves fatality when used in a cause chain", () => {
    const err = new InvalidInputError({ message: "empty input" });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngineError);
    expect(err.isFatal).toBe(false);
    const fatal = new ItemSelectionError(3, { cause: err, message: "Input preparation failed" });
    const wrapped = new EngineError("Command failed", { cause: fatal, isFatal: false });
    expect(wrapped.message).toBe("Command failed");
    expect(wrapped.isFatal).toBe(true);
    expect(wrapped.cause).toBe(fatal);
    expect(fatal).toBeInstanceOf(EngineError);
    expect(fatal.name).toBe("ItemSelectionError");
    expect(fatal.isFatal).toBe(true);
    expect(fatal.cause).toBe(err);
    expect(fatal.index).toBe(3);
    expect(fatal.message).toBe("Input preparation failed");
    const invalid = new InvalidInputError({ cause: fatal });
    expect(invalid.isFatal).toBe(true);
    expect(invalid.cause).toBe(fatal);
  });

  it("provides a default message and its error name", () => {
    const err = new InvalidInputError();
    expect(err.name).toBe("InvalidInputError");
    expect(err.message).toBe("Invalid input.");
    expect(new EngineError().message).toBe("Engine operation failed.");
  });

  it("preserves custom message", () => {
    const err = new InvalidInputError({ message: "Data cannot be null" });
    expect(err.message).toBe("Data cannot be null");
    expect(err.cause).toBeUndefined();
  });
});

describe("IndexOutOfBoundsError", () => {
  it("is an instance of Error", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EngineError);
  });

  it("preserves an empty message override and its cause", () => {
    const cause = new Error("Invalid position");
    const err = new IndexOutOfBoundsError(10, 5, { message: "", cause });
    expect(err.name).toBe("IndexOutOfBoundsError");
    expect(err.message).toBe("");
    expect(err.cause).toBe(cause);
  });

  it("exposes index and totalItems", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err.index).toBe(10);
    expect(err.totalItems).toBe(5);
    expect(err.isFatal).toBe(false);
  });

  it("includes index and bounds in message", () => {
    const err = new IndexOutOfBoundsError(10, 5);
    expect(err.message).toContain("10");
    expect(err.message).toContain("0..4");
  });
});

describe("ListenerError", () => {
  it("keeps fatal engine causes outside the engine error family and provides event context", () => {
    const cause = new EngineError("consumer failure", { isFatal: true });
    const failure = new ListenerError("advanced", { cause });
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(EngineError);
    expect(failure).not.toHaveProperty("isFatal");
    expect(failure.name).toBe("ListenerError");
    expect(failure.message).toContain("advanced");
    expect(failure.eventType).toBe("advanced");
    expect(failure.cause).toBe(cause);
    expect(new ListenerError("started", { message: "Custom listener failure" }).message).toBe(
      "Custom listener failure",
    );
  });
});
