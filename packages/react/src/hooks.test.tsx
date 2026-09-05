import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRsvpController } from "./controller";
import { useControllerSelector } from "./hooks";

const officialSelectorHook = vi.hoisted(() => vi.fn(() => "official selection"));

vi.mock("use-sync-external-store/with-selector", () => ({
  useSyncExternalStoreWithSelector: officialSelectorHook,
}));

afterEach(() => {
  officialSelectorHook.mockClear();
});

describe("controller selector hook", () => {
  it("delegates concurrent-safe selection to React's official external-store hook", () => {
    const controller = createRsvpController({ data: "one two" });
    const selector = () => "local selection";
    const equalityFn = Object.is;

    const { result } = renderHook(() => useControllerSelector(controller, selector, equalityFn));

    expect(result.current).toBe("official selection");
    expect(officialSelectorHook).toHaveBeenCalledWith(
      controller.subscribe,
      controller.getSnapshot,
      controller.getServerSnapshot,
      selector,
      equalityFn,
    );
    controller.destroy();
  });
});
