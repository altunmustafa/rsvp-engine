import type { PropsWithChildren, ReactNode } from "react";

import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, act } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRsvpContext, createRsvpController } from "./index";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("context-bound React bindings", () => {
  it("rerenders only when the selected value changes", () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    let renders = 0;

    function Speed(): ReactNode {
      renders++;
      const wpm = useRsvpSelector(({ snapshot }) => snapshot.wpm);
      return <span>{wpm}</span>;
    }

    const rendered = render(
      <RsvpProvider controller={controller}>
        <Speed />
      </RsvpProvider>,
    );

    expect(renders).toBe(1);
    act(() => controller.load("three four five"));
    expect(renders).toBe(1);

    act(() => controller.setSpeed(600));
    expect(renders).toBe(2);
    expect(rendered.container.textContent).toBe("600");
    controller.destroy();
  });

  it("supports a custom equality function for derived selector values", () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result } = renderHook(
      () =>
        useRsvpSelector(
          ({ snapshot }) => ({ wpm: snapshot.wpm }),
          (left, right) => left.wpm === right.wpm,
        ),
      { wrapper: Wrapper },
    );
    const initial = result.current;

    act(() => controller.load("three four"));
    expect(result.current).toBe(initial);

    act(() => controller.setSpeed(600));
    expect(result.current).toEqual({ wpm: 600 });
    expect(result.current).not.toBe(initial);
    controller.destroy();
  });

  it("returns stable actions without subscribing to state changes", () => {
    const controller = createRsvpController<string>();
    const subscribe = vi.spyOn(controller, "subscribe");
    const { RsvpProvider, useRsvpActions } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { rerender, result } = renderHook(() => useRsvpActions(), { wrapper: Wrapper });
    const initial = result.current;

    expect(initial.play).toBe(controller.play);
    expect(initial.clearError).toBe(controller.clearError);
    expect(subscribe).not.toHaveBeenCalled();

    act(() => controller.load("one two"));
    rerender();
    expect(result.current).toBe(initial);
    expect(subscribe).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("exposes the provided controller as a non-reactive escape hatch", () => {
    const controller = createRsvpController<number>({ data: [1, 2] });
    const subscribe = vi.spyOn(controller, "subscribe");
    const { RsvpProvider, useRsvpController } = createRsvpContext<number>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result } = renderHook(() => useRsvpController(), { wrapper: Wrapper });

    expect(result.current).toBe(controller);
    expect(subscribe).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("switches selector subscriptions when the Provider controller changes", () => {
    const first = createRsvpController({ wpm: 300 });
    const second = createRsvpController({ wpm: 600 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    function Speed(): ReactNode {
      return <span>{useRsvpSelector(({ snapshot }) => snapshot.wpm)}</span>;
    }
    const rendered = render(
      <RsvpProvider controller={first}>
        <Speed />
      </RsvpProvider>,
    );

    rendered.rerender(
      <RsvpProvider controller={second}>
        <Speed />
      </RsvpProvider>,
    );
    expect(rendered.container.textContent).toBe("600");

    act(() => first.setSpeed(900));
    expect(rendered.container.textContent).toBe("600");

    act(() => second.setSpeed(1_200));
    expect(rendered.container.textContent).toBe("1200");
    first.destroy();
    second.destroy();
  });

  it("balances Strict Mode selector subscriptions and cleanup", () => {
    const controller = createRsvpController<string>();
    const originalSubscribe = controller.subscribe;
    const cleanups: ReturnType<typeof vi.fn>[] = [];
    const subscribe = vi
      .spyOn(controller, "subscribe")
      .mockImplementation((listener: Parameters<typeof controller.subscribe>[0]) => {
        const unsubscribe = originalSubscribe(listener);
        const trackedCleanup = vi.fn(unsubscribe);
        cleanups.push(trackedCleanup);
        return trackedCleanup;
      });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <StrictMode>
        <RsvpProvider controller={controller}>{children}</RsvpProvider>
      </StrictMode>
    );

    const { unmount } = renderHook(() => useRsvpSelector(({ snapshot }) => snapshot.state), {
      wrapper: Wrapper,
    });
    unmount();

    expect(subscribe.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(cleanups).toHaveLength(subscribe.mock.calls.length);
    expect(cleanups.every((trackedCleanup) => trackedCleanup.mock.calls.length === 1)).toBe(true);
    controller.destroy();
  });

  it("unsubscribes on unmount without stopping playback", () => {
    vi.useFakeTimers();
    const controller = createRsvpController({ data: "one two", wpm: 600 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { unmount } = renderHook(() => useRsvpSelector(({ snapshot }) => snapshot.currentIndex), {
      wrapper: Wrapper,
    });

    act(() => controller.play());
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(controller.getSnapshot().snapshot).toMatchObject({
      state: "PLAYING",
      currentIndex: 1,
    });
    controller.destroy();
  });

  it("never destroys the externally owned Provider controller", () => {
    const controller = createRsvpController<number>({ data: [1, 2] });
    const destroy = vi.spyOn(controller, "destroy");
    const { RsvpProvider, useRsvpActions } = createRsvpContext<number>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result, unmount } = renderHook(() => useRsvpActions(), { wrapper: Wrapper });

    act(() => result.current.load([3, 4, 5]));
    expect(controller.getSnapshot().snapshot.totalItems).toBe(3);

    unmount();
    expect(destroy).not.toHaveBeenCalled();
    expect(() => controller.setSpeed(600)).not.toThrow();
    controller.destroy();
  });

  it("throws a clear error when a context hook has no matching Provider", () => {
    vi.spyOn(globalThis.console, "error").mockImplementation(() => undefined);
    const { useRsvpController } = createRsvpContext<string>();

    expect(() => renderHook(() => useRsvpController())).toThrow(
      "RSVP context hooks must be used within their matching RsvpProvider.",
    );
  });

  it("selects from the construction snapshot for SSR and live state after hydration", async () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const View = (): ReactNode => {
      const wpm = useRsvpSelector(({ snapshot }) => snapshot.wpm);
      return <span>{wpm}</span>;
    };
    controller.setSpeed(600);

    const tree = (
      <RsvpProvider controller={controller}>
        <View />
      </RsvpProvider>
    );
    const serverMarkup = renderToString(tree);
    expect(serverMarkup).toContain("300");

    const container = globalThis.document.createElement("div");
    container.innerHTML = serverMarkup;
    globalThis.document.body.append(container);
    const rendered = render(tree, { container, hydrate: true });

    await waitFor(() => expect(rendered.container.textContent).toBe("600"));
    rendered.unmount();
    container.remove();
    controller.destroy();
  });
});
