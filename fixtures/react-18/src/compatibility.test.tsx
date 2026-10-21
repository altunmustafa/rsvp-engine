import type { ReactNode } from "react";

import { DefaultTokenizer } from "@rsvp-engine/core";
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { act, version as reactVersion } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

afterEach(cleanup);

describe("React 18 compatibility", () => {
  it("uses the fixture's React major", () => {
    expect(Number.parseInt(reactVersion, 10)).toBe(18);
  });

  it("hydrates empty SSR content with loaded metadata and updates through public actions", async () => {
    interface SourceSpan {
      readonly start: number;
      readonly end: number;
    }
    const controller = createRsvpController({
      tokenizer: {
        tokenize: () => [
          { value: "hello", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 5 } },
        ],
      },
    });
    controller.load("hello");
    const { RsvpProvider, useRsvpSelector, useRsvpActions } = createRsvpContext<
      string,
      SourceSpan
    >();
    function Word(): ReactNode {
      const start = useRsvpSelector((snapshot) => snapshot.currentItem?.meta?.start);
      const { loadTokens } = useRsvpActions();
      return (
        <button
          onClick={() =>
            loadTokens([
              { value: "world", ovpIndex: 0, durationMultiplier: 1, meta: { start: 6, end: 11 } },
            ])
          }
        >
          {start}
        </button>
      );
    }
    const tree = (
      <RsvpProvider controller={controller}>
        <Word />
      </RsvpProvider>
    );
    const serverMarkup = renderToString(tree);
    expect(serverMarkup).toBe("<button></button>");
    const container = globalThis.document.createElement("div");
    container.innerHTML = serverMarkup;
    globalThis.document.body.append(container);
    const rendered = render(tree, { container, hydrate: true });
    await waitFor(() => expect(rendered.container.textContent).toBe("0"));
    act(() => rendered.getByRole("button").click());
    expect(rendered.container.textContent).toBe("6");
    expect(controller.getServerSnapshot().currentItem).toBeNull();
    rendered.unmount();
    container.remove();
    controller.destroy();
  });

  it("renders and updates through the public package API", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
      wpm: 300,
    });
    controller.load("one two");
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();

    function Speed(): ReactNode {
      const wpm = useRsvpSelector((snapshot) => snapshot.wpm);
      return <span>{wpm}</span>;
    }

    const rendered = render(
      <RsvpProvider controller={controller}>
        <Speed />
      </RsvpProvider>,
    );

    expect(rendered.container.textContent).toBe("300");
    act(() => controller.setWpm(600));
    expect(rendered.container.textContent).toBe("600");
    controller.destroy();
  });

  it("updates OVP through public actions and selectors", () => {
    const controller = createRsvpController({
      tokenizer: new DefaultTokenizer<string>(),
    });
    controller.load("hello world");
    const { RsvpProvider, useRsvpSelector, useRsvpActions } = createRsvpContext<string>();
    function Word(): ReactNode {
      const offset = useRsvpSelector((snapshot) => snapshot.currentItem?.ovpIndex);
      const { setOvpStrategy } = useRsvpActions();
      return <button onClick={() => setOvpStrategy({ calculate: () => 0 })}>{offset}</button>;
    }
    const rendered = render(
      <RsvpProvider controller={controller}>
        <Word />
      </RsvpProvider>,
    );
    expect(rendered.container.textContent).toBe("1");
    act(() => rendered.getByRole("button").click());
    expect(rendered.container.textContent).toBe("0");
    controller.destroy();
  });
});
