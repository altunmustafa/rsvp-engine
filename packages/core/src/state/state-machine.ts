import type { RsvpState, StateMachineAction } from "./types";

import { InvalidTransitionError } from "../errors";

export class StateMachine {
  #state: RsvpState = "IDLE";

  readonly #transitions: Record<RsvpState, Partial<Record<StateMachineAction, RsvpState>>> = {
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

  public get state(): RsvpState {
    return this.#state;
  }

  public transition(action: StateMachineAction): RsvpState {
    const allowedTransitions = this.#transitions[this.#state];
    const nextState = allowedTransitions[action];

    if (!nextState) {
      throw new InvalidTransitionError(this.#state, action);
    }

    this.#state = nextState;
    return this.#state;
  }
}
