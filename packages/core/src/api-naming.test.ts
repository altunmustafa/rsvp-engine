import { expect, it } from "vitest";

import * as core from "./index";

it("exports public constructors and supports WPM commands", () => {
  expect(core.RsvpEngine).toBeTypeOf("function");
  expect(core.EngineError).toBeTypeOf("function");
  expect(core.DefaultOvpStrategy).toBeTypeOf("function");

  const engine = new core.RsvpEngine();
  engine.setWpm(225);
  expect(engine.wpm).toBe(225);
  expect(engine.getSnapshot().wpm).toBe(225);
  engine.destroy();
});
