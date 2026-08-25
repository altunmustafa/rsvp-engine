import type { RSVPState, StateMachineAction } from "./types";

import { describe, expect, it } from "vitest";

import { InvalidTransitionError } from "../errors";

import { StateMachine } from "./state-machine";

describe("StateMachine", () => {
  it("starts in IDLE state", () => {
    const sMachine = new StateMachine();
    expect(sMachine.state).toBe("IDLE");
  });

  const setupStateMachine = (state: RSVPState): StateMachine => {
    const sMachine = new StateMachine();
    switch (state) {
      case "IDLE":
        break;
      case "PLAYING":
        sMachine.transition("play");
        break;
      case "PAUSED":
        sMachine.transition("play");
        sMachine.transition("pause");
        break;
      case "STOPPED":
        sMachine.transition("play");
        sMachine.transition("stop");
        break;
      case "COMPLETED":
        sMachine.transition("play");
        sMachine.transition("complete");
        break;
      case "ERROR":
        sMachine.transition("error");
        break;
    }
    return sMachine;
  };

  describe("Valid transitions", () => {
    const validTransitions: { from: RSVPState; action: StateMachineAction; to: RSVPState }[] = [
      { from: "IDLE", action: "play", to: "PLAYING" },
      { from: "IDLE", action: "load", to: "IDLE" },
      { from: "IDLE", action: "error", to: "ERROR" },

      { from: "PLAYING", action: "pause", to: "PAUSED" },
      { from: "PLAYING", action: "stop", to: "STOPPED" },
      { from: "PLAYING", action: "complete", to: "COMPLETED" },
      { from: "PLAYING", action: "error", to: "ERROR" },

      { from: "PAUSED", action: "play", to: "PLAYING" },
      { from: "PAUSED", action: "load", to: "IDLE" },
      { from: "PAUSED", action: "stop", to: "STOPPED" },
      { from: "PAUSED", action: "seek", to: "PAUSED" },
      { from: "PAUSED", action: "error", to: "ERROR" },

      { from: "STOPPED", action: "play", to: "PLAYING" },
      { from: "STOPPED", action: "load", to: "IDLE" },
      { from: "STOPPED", action: "seek", to: "PAUSED" },
      { from: "STOPPED", action: "error", to: "ERROR" },

      { from: "COMPLETED", action: "play", to: "PLAYING" },
      { from: "COMPLETED", action: "load", to: "IDLE" },
      { from: "COMPLETED", action: "seek", to: "PAUSED" },
      { from: "COMPLETED", action: "error", to: "ERROR" },

      { from: "ERROR", action: "reset", to: "IDLE" },
    ];

    it.for(validTransitions)("transitions from $from to $to on $action", ({ from, action, to }) => {
      const sMachine = setupStateMachine(from);

      expect(sMachine.state).toBe(from);
      expect(sMachine.transition(action)).toBe(to);
      expect(sMachine.state).toBe(to);
    });
  });

  describe("Invalid transitions", () => {
    const invalidTransitions: { from: RSVPState; action: StateMachineAction }[] = [
      { from: "IDLE", action: "pause" },
      { from: "IDLE", action: "stop" },
      { from: "IDLE", action: "seek" },
      { from: "IDLE", action: "complete" },
      { from: "IDLE", action: "reset" },

      { from: "PLAYING", action: "play" },
      { from: "PLAYING", action: "seek" },
      { from: "PLAYING", action: "reset" },
      { from: "PLAYING", action: "load" },

      { from: "PAUSED", action: "pause" },
      { from: "PAUSED", action: "complete" },
      { from: "PAUSED", action: "reset" },

      { from: "STOPPED", action: "pause" },
      { from: "STOPPED", action: "stop" },
      { from: "STOPPED", action: "complete" },
      { from: "STOPPED", action: "reset" },

      { from: "COMPLETED", action: "pause" },
      { from: "COMPLETED", action: "stop" },
      { from: "COMPLETED", action: "complete" },
      { from: "COMPLETED", action: "reset" },

      { from: "ERROR", action: "play" },
      { from: "ERROR", action: "pause" },
      { from: "ERROR", action: "stop" },
      { from: "ERROR", action: "seek" },
      { from: "ERROR", action: "complete" },
      { from: "ERROR", action: "error" },
      { from: "ERROR", action: "load" },
    ];

    it.for(invalidTransitions)(
      "throws InvalidTransitionError when transitioning from $from on $action",
      ({ from, action }) => {
        const targetSM = setupStateMachine(from);

        expect(targetSM.state).toBe(from);
        expect(() => targetSM.transition(action)).toThrowError(InvalidTransitionError);
      },
    );
  });
});
