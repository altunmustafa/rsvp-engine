import { expect, it } from "vitest";

import * as core from "./index";

it("exports normalized names without legacy runtime aliases", () => {
  expect(core.RsvpEngine).toBeTypeOf("function");
  expect(core.DefaultOvpStrategy).toBeTypeOf("function");
  expect(core).not.toHaveProperty("RSVPEngine");
  expect(core).not.toHaveProperty("DefaultOVPStrategy");

  const engine = new core.RsvpEngine();
  engine.setWpm(225);
  expect(engine.wpm).toBe(225);
  expect(engine.snapshot().wpm).toBe(225);
  expect(engine).not.toHaveProperty("setSpeed");
  engine.destroy();
});
