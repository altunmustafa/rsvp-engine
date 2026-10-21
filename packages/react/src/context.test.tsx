import type { PropsWithChildren, ReactNode } from "react";

import { DefaultTokenizer } from "@rsvp-engine/core";
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
  it("preserves metadata through actions and skips metadata renders for OVP-only changes", () => {
    const first = { start: 0, end: 5 };
    const second = { start: 6, end: 11 };
    const controller = createRsvpController({
      tokenizer: {
        tokenize: () => [
          { value: "hello", ovpIndex: 2, durationMultiplier: 1, meta: first },
          { value: "world", ovpIndex: 2, durationMultiplier: 1, meta: second },
        ],
      },
    });
    controller.load("hello world");
    const { RsvpProvider, useRsvpActions, useRsvpSelector } = createRsvpContext<
      string,
      typeof first
    >();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    let renders = 0;
    const { result, unmount } = renderHook(
      () => {
        renders++;
        return {
          meta: useRsvpSelector((snapshot) => snapshot.currentItem?.meta),
          actions: useRsvpActions(),
        };
      },
      { wrapper: Wrapper },
    );
    const actions = result.current.actions;
    expect(result.current.meta).toBe(first);
    act(() => actions.setOvpStrategy({ calculate: () => 0 }));
    expect(controller.getSnapshot().currentItem?.ovpIndex).toBe(0);
    expect(result.current.meta).toBe(first);
    expect(renders).toBe(1);
    act(() => actions.seek(1));
    expect(result.current.meta).toBe(second);
    expect(renders).toBe(2);
    const replacement = { start: 12, end: 17 };
    act(() =>
      actions.loadTokens([
        { value: "again", ovpIndex: 0, durationMultiplier: 1, meta: replacement },
      ]),
    );
    expect(result.current.meta).toBe(replacement);
    unmount();
    controller.destroy();
  });

  it("exposes stable OVP actions and rerenders only selectors whose presentation changes", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
    });
    controller.load("hello world");
    const { RsvpProvider, useRsvpActions, useRsvpSelector } = createRsvpContext<string>();
    let timingRenders = 0;
    function Timing(): ReactNode {
      timingRenders++;
      const timing = useRsvpSelector((snapshot) => snapshot.timing);
      return <span>{timing.totalDurationMs}</span>;
    }
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>
        <Timing />
        {children}
      </RsvpProvider>
    );
    const { result } = renderHook(
      () => ({
        actions: useRsvpActions(),
        ovpIndex: useRsvpSelector((snapshot) => snapshot.currentItem?.ovpIndex),
      }),
      { wrapper: Wrapper },
    );
    const actions = result.current.actions;
    expect(actions.setOvpStrategy).toBe(controller.setOvpStrategy);
    expect(result.current.ovpIndex).toBe(1);
    act(() => actions.setOvpStrategy({ calculate: () => 0 }));
    expect(result.current.ovpIndex).toBe(0);
    expect(result.current.actions).toBe(actions);
    expect(timingRenders).toBe(1);
    controller.destroy();
  });

  it("preserves exact slider values through speed actions and selectors", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
    });
    const { RsvpProvider, useRsvpActions, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result } = renderHook(
      () => ({ actions: useRsvpActions(), wpm: useRsvpSelector((snapshot) => snapshot.wpm) }),
      { wrapper: Wrapper },
    );
    const actions = result.current.actions;
    expect(actions.setWpm).toBe(controller.setWpm);
    for (const wpm of [225, 425, 450, 825, 850, 900, 925]) {
      act(() => actions.setWpm(wpm));
      expect(result.current.wpm).toBe(wpm);
      expect(result.current.actions).toBe(actions);
    }
    controller.destroy();
  });

  it("rerenders only when the selected value changes", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 300,
    });
    controller.load("one two");
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    let renders = 0;

    function Speed(): ReactNode {
      renders++;
      const wpm = useRsvpSelector((snapshot) => snapshot.wpm);
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

    act(() => controller.setWpm(600));
    expect(renders).toBe(2);
    expect(rendered.container.textContent).toBe("600");
    controller.destroy();
  });

  it("supports a custom equality function for derived selector values", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 300,
    });
    controller.load("one two");
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result } = renderHook(
      () =>
        useRsvpSelector(
          (snapshot) => ({ wpm: snapshot.wpm }),
          (left, right) => left.wpm === right.wpm,
        ),
      { wrapper: Wrapper },
    );
    const initial = result.current;

    act(() => controller.load("three four"));
    expect(result.current).toBe(initial);

    act(() => controller.setWpm(600));
    expect(result.current).toEqual({ wpm: 600 });
    expect(result.current).not.toBe(initial);
    controller.destroy();
  });

  it("returns stable actions without subscribing to state changes", () => {
    const controller = createRsvpController<string>({
      tokenizer: new DefaultTokenizer<string>(),
    });
    const subscribe = vi.spyOn(controller, "subscribe");
    const { RsvpProvider, useRsvpActions } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { rerender, result } = renderHook(() => useRsvpActions(), { wrapper: Wrapper });
    const initial = result.current;

    expect(initial.play).toBe(controller.play);
    expect(subscribe).not.toHaveBeenCalled();

    act(() => controller.load("one two"));
    rerender();
    expect(result.current).toBe(initial);
    expect(subscribe).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("exposes the provided controller as a non-reactive escape hatch", () => {
    const controller = createRsvpController<number>({
      tokenizer: new DefaultTokenizer<number>(),
    });
    controller.load([1, 2]);
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
    const first = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 300,
    });
    const second = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
    });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    function Speed(): ReactNode {
      return <span>{useRsvpSelector((snapshot) => snapshot.wpm)}</span>;
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

    act(() => first.setWpm(900));
    expect(rendered.container.textContent).toBe("600");

    act(() => second.setWpm(1_200));
    expect(rendered.container.textContent).toBe("1200");
    first.destroy();
    second.destroy();
  });

  it("balances Strict Mode selector subscriptions and cleanup", () => {
    const controller = createRsvpController<string>({
      tokenizer: new DefaultTokenizer<string>(),
    });
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

    const { unmount } = renderHook(() => useRsvpSelector((snapshot) => snapshot.state), {
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
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 600,
    });
    controller.load("one two");
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { unmount } = renderHook(() => useRsvpSelector((snapshot) => snapshot.currentIndex), {
      wrapper: Wrapper,
    });

    act(() => controller.play());
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(controller.getSnapshot()).toMatchObject({
      state: "PLAYING",
      currentIndex: 1,
    });
    controller.destroy();
  });

  it("never destroys the externally owned Provider controller", () => {
    const controller = createRsvpController<number>({
      tokenizer: new DefaultTokenizer<number>(),
    });
    controller.load([1, 2]);
    const destroy = vi.spyOn(controller, "destroy");
    const { RsvpProvider, useRsvpActions } = createRsvpContext<number>();
    const Wrapper = ({ children }: PropsWithChildren): ReactNode => (
      <RsvpProvider controller={controller}>{children}</RsvpProvider>
    );
    const { result, unmount } = renderHook(() => useRsvpActions(), { wrapper: Wrapper });

    act(() => result.current.load([3, 4, 5]));
    expect(controller.getSnapshot().totalItems).toBe(3);

    unmount();
    expect(destroy).not.toHaveBeenCalled();
    expect(() => controller.setWpm(600)).not.toThrow();
    controller.destroy();
  });

  it("throws a clear error when a context hook has no matching Provider", () => {
    vi.spyOn(globalThis.console, "error").mockImplementation(() => undefined);
    const { useRsvpController } = createRsvpContext<string>();

    expect(() => renderHook(() => useRsvpController())).toThrow(
      "RSVP context hooks must be used within their matching RsvpProvider.",
    );
  });

  it("hydrates empty server content with live metadata and speed", async () => {
    interface SourceSpan {
      readonly start: number;
      readonly end: number;
    }
    const controller = createRsvpController<string, SourceSpan>({ wpm: 300 });
    controller.loadTokens([
      { value: "later", ovpIndex: 0, durationMultiplier: 1, meta: { start: 10, end: 15 } },
    ]);
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string, SourceSpan>();
    const View = (): ReactNode => {
      const wpm = useRsvpSelector((snapshot) => snapshot.wpm);
      const span = useRsvpSelector((snapshot) => snapshot.currentItem?.meta);
      return <span>{`${wpm}:${span?.start ?? ""}`}</span>;
    };
    controller.setWpm(600);

    const tree = (
      <RsvpProvider controller={controller}>
        <View />
      </RsvpProvider>
    );
    const serverMarkup = renderToString(tree);
    expect(serverMarkup).toBe("<span>300:</span>");

    const container = globalThis.document.createElement("div");
    container.innerHTML = serverMarkup;
    globalThis.document.body.append(container);
    const rendered = render(tree, { container, hydrate: true });

    await waitFor(() => expect(rendered.container.textContent).toBe("600:10"));
    rendered.unmount();
    container.remove();
    controller.destroy();
  });
});
