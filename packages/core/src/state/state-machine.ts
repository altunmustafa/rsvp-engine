import type { RSVPState, StateMachineAction } from "./types";

import { InvalidTransitionError } from "../errors";

export class StateMachine {
  #state: RSVPState = "IDLE";

  readonly #transitions: Record<RSVPState, Partial<Record<StateMachineAction, RSVPState>>> = {
    IDLE: {
      load: "IDLE",
      play: "PLAYING",
      error: "ERROR",
    },
    PLAYING: {
      pause: "PAUSED",
      stop: "STOPPED",
      complete: "COMPLETED",
      error: "ERROR",
    },
    PAUSED: {
      load: "IDLE",
      play: "PLAYING",
      stop: "STOPPED",
      seek: "PAUSED",
      error: "ERROR",
    },
    STOPPED: {
      load: "IDLE",
      play: "PLAYING",
      seek: "PAUSED",
      error: "ERROR",
    },
    COMPLETED: {
      load: "IDLE",
      play: "PLAYING",
      seek: "PAUSED",
      error: "ERROR",
    },
    ERROR: {
      reset: "IDLE",
    },
  };

  public get state(): RSVPState {
    return this.#state;
  }

  public transition(action: StateMachineAction): RSVPState {
    const allowedTransitions = this.#transitions[this.#state];
    const nextState = allowedTransitions[action];

    if (!nextState) {
      throw new InvalidTransitionError(this.#state, action);
    }

    this.#state = nextState;
    return this.#state;
  }
}
