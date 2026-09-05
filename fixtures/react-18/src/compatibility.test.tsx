import type { ReactNode } from "react";

import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";
import { cleanup, render } from "@testing-library/react";
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

  it("renders and updates through the public package API", () => {
    const controller = createRsvpController({ data: "one two", wpm: 300 });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();

    function Speed(): ReactNode {
      const wpm = useRsvpSelector(({ snapshot }) => snapshot.wpm);
      return <span>{wpm}</span>;
    }

    const rendered = render(
      <RsvpProvider controller={controller}>
        <Speed />
      </RsvpProvider>,
    );

    expect(rendered.container.textContent).toBe("300");
    act(() => controller.setSpeed(600));
    expect(rendered.container.textContent).toBe("600");
    controller.destroy();
  });

  it("renders through the public package API during SSR", () => {
    const controller = createRsvpController({ data: "one two" });
    const { RsvpProvider, useRsvpSelector } = createRsvpContext<string>();

    function Word(): ReactNode {
      return <span>{useRsvpSelector(({ snapshot }) => snapshot.currentItem?.value)}</span>;
    }

    expect(
      renderToString(
        <RsvpProvider controller={controller}>
          <Word />
        </RsvpProvider>,
      ),
    ).toContain("one");
    controller.destroy();
  });
});
