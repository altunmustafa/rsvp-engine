import type { RsvpActions, RsvpController } from "../src";
import type { RsvpEngine } from "@rsvp-engine/core";

export type {
  RsvpEngineOptions,
  RsvpItem,
  RsvpSnapshot,
  RsvpState,
  RsvpEventType,
  RsvpEventMap,
  OvpStrategy,
} from "@rsvp-engine/core";

export type {
  RsvpEngineOptions as ReactRsvpEngineOptions,
  RsvpItem as ReactRsvpItem,
  RsvpSnapshot as ReactRsvpSnapshot,
  RsvpState as ReactRsvpState,
  OvpStrategy as ReactOvpStrategy,
} from "../src";

export function checkSpeedCommands(
  engine: RsvpEngine,
  controller: RsvpController,
  actions: RsvpActions,
): void {
  engine.setWpm(225);
  controller.setWpm(225);
  actions.setWpm(225);
  // @ts-expect-error The old Core command is removed, not retained as an alias.
  engine.setSpeed(225);
  // @ts-expect-error The old controller command is removed.
  controller.setSpeed(225);
  // @ts-expect-error The old action is removed.
  actions.setSpeed(225);
}
