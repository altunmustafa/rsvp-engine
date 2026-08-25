/** All possible states of the RSVP engine lifecycle. */
export type RSVPState = "IDLE" | "PLAYING" | "PAUSED" | "STOPPED" | "COMPLETED" | "ERROR";

/** Commands accepted by the state machine transition table. */
export type StateMachineAction =
  "play" | "pause" | "stop" | "seek" | "complete" | "error" | "reset" | "load";
