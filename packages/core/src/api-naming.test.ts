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
  expect(engine.getSnapshot().wpm).toBe(225);
  expect(core).not.toHaveProperty("EventEmitter");
  expect(engine).not.toHaveProperty("on");
  expect(engine).not.toHaveProperty("snapshot");
  expect(engine).not.toHaveProperty("setSpeed");
  engine.destroy();
});
