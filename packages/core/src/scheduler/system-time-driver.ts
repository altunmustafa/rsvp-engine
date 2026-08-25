import type { TimeDriver } from "./types";
import type { RuntimeGlobal } from "../runtimeGlobal";

/**
 * Default implementation of `TimeDriver` utilizing platform globals
 * (`performance.now` / `Date.now` and `setTimeout` / `clearTimeout`).
 */
export class SystemTimeDriver implements TimeDriver {
  public now(): number {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    if (typeof runtimeGlobal.performance?.now === "function") {
      return runtimeGlobal.performance.now();
    }
    return Date.now();
  }

  public setTimeout(callback: () => void, ms: number): unknown {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    if (typeof runtimeGlobal.setTimeout !== "function") {
      throw new TypeError("The runtime does not provide setTimeout.");
    }
    return runtimeGlobal.setTimeout(callback, ms);
  }

  public clearTimeout(handle: unknown): void {
    const runtimeGlobal = globalThis as RuntimeGlobal;
    if (typeof runtimeGlobal.clearTimeout !== "function") {
      throw new TypeError("The runtime does not provide clearTimeout.");
    }
    runtimeGlobal.clearTimeout(handle);
  }
}
