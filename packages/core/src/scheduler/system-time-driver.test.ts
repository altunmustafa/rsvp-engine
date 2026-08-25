import { afterEach, describe, expect, it, vi } from "vitest";

import { SystemTimeDriver } from "./system-time-driver";

describe("SystemTimeDriver", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("uses performance.now when available", () => {
    const driver = new SystemTimeDriver();
    const perfSpy = vi.spyOn(globalThis.performance, "now").mockReturnValue(12345.61);

    expect(driver.now()).toBe(12345.61);
    expect(perfSpy).toHaveBeenCalled();
  });

  it("falls back to Date.now when performance API is unavailable", () => {
    const driver = new SystemTimeDriver();
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(98761);
    vi.stubGlobal("performance", undefined);

    expect(driver.now()).toBe(98761);
    expect(dateSpy).toHaveBeenCalled();
  });

  it("falls back to Date.now when performance.now is unavailable", () => {
    const driver = new SystemTimeDriver();
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(54321);
    vi.stubGlobal("performance", {});

    expect(driver.now()).toBe(54321);
    expect(dateSpy).toHaveBeenCalled();
  });

  it("returns the exact global timer handle and clears the same handle", () => {
    const handle = { id: 42 };
    const setTimeoutSpy = vi.fn(() => handle);
    const clearTimeoutSpy = vi.fn();
    vi.stubGlobal("setTimeout", setTimeoutSpy);
    vi.stubGlobal("clearTimeout", clearTimeoutSpy);

    const driver = new SystemTimeDriver();
    const callback = vi.fn();
    const returnedHandle = driver.setTimeout(callback, 100);

    expect(returnedHandle).toBe(handle);
    expect(setTimeoutSpy).toHaveBeenCalledWith(callback, 100);

    driver.clearTimeout(returnedHandle);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(handle);
  });

  it("fails fast when the runtime does not provide setTimeout", () => {
    vi.stubGlobal("setTimeout", undefined);

    const driver = new SystemTimeDriver();

    expect(() => driver.setTimeout(vi.fn(), 100)).toThrow(TypeError);
  });

  it("fails fast when the runtime does not provide clearTimeout", () => {
    vi.stubGlobal("clearTimeout", undefined);

    const driver = new SystemTimeDriver();

    expect(() => driver.clearTimeout({ id: 42 })).toThrow(TypeError);
  });
});
