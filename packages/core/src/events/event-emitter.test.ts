import type { StateChangePayload } from "./types";

import { describe, expect, it, vi } from "vitest";

import { EventEmitter } from "./event-emitter";

describe("EventEmitter", () => {
  it("on() adds listener that receives emit() payloads", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.on("stateChange", cb);
    const payload = { previous: "IDLE", current: "PLAYING" } as StateChangePayload;
    emitter.emit("stateChange", payload);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(payload);
  });

  it("on() returns unsubscribe function that removes the listener", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    const unsubscribe = emitter.on("stateChange", cb);
    unsubscribe();
    emitter.emit("stateChange", {} as never);
    expect(cb).not.toHaveBeenCalled();
  });

  it("Multiple listeners on same event all fire", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on("itemChange", cb1);
    emitter.on("itemChange", cb2);
    emitter.emit("itemChange", {} as never);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

  it("Emitting an event with no listeners does not throw", () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit("itemChange", {} as never)).not.toThrow();
  });

  it("removeAllListeners() clears all listeners", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    emitter.on("itemChange", cb1);
    emitter.on("error", cb2);
    emitter.removeAllListeners();
    emitter.emit("itemChange", {} as never);
    emitter.emit("error", {} as never);
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it("Listener error on non-error event emits error event", () => {
    const emitter = new EventEmitter();
    const errorMsg = "Test error";
    const cb1 = vi.fn().mockImplementation(() => {
      throw new Error(errorMsg);
    });
    const errorCb = vi.fn();
    emitter.on("itemChange", cb1);
    emitter.on("error", errorCb);

    emitter.emit("itemChange", {} as never);
    expect(cb1).toHaveBeenCalledOnce();
    expect(errorCb).toHaveBeenCalledOnce();
    expect(errorCb.mock.calls[0][0].error.message).toBe(errorMsg);
  });

  it("Listener error with non-Error thrown (string) converts to Error instance", () => {
    const emitter = new EventEmitter();
    const cb1 = vi.fn().mockImplementation(() => {
      throw "String exception";
    });
    const errorCb = vi.fn();
    emitter.on("itemChange", cb1);
    emitter.on("error", errorCb);

    emitter.emit("itemChange", {} as never);
    expect(errorCb).toHaveBeenCalledOnce();
    expect(errorCb.mock.calls[0][0].error.message).toBe("String exception");
  });

  it("Listener error on error event is silently swallowed (no crash)", () => {
    const emitter = new EventEmitter();
    const errorCb = vi.fn().mockImplementation(() => {
      throw new Error("Nested error");
    });
    emitter.on("error", errorCb);

    expect(() => {
      emitter.emit("error", { error: new Error("Initial error") });
    }).not.toThrow();
    expect(errorCb).toHaveBeenCalledOnce();
  });

  it("Same callback added twice is only called once (Set semantics)", () => {
    const emitter = new EventEmitter();
    const cb = vi.fn();
    emitter.on("itemChange", cb);
    emitter.on("itemChange", cb);
    emitter.emit("itemChange", {} as never);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("Unsubscribing during iteration doesnt crash", () => {
    const emitter = new EventEmitter();
    const cb2 = vi.fn();

    const cb1 = vi.fn().mockImplementation(() => {
      unsubscribe2();
    });

    emitter.on("itemChange", cb1);
    const unsubscribe2 = emitter.on("itemChange", cb2);

    expect(() => {
      emitter.emit("itemChange", {} as never);
    }).not.toThrow();

    expect(cb1).toHaveBeenCalledOnce();
  });
});
