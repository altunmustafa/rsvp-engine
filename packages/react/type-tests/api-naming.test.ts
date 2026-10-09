import type { RsvpActions, RsvpController } from "../src";
import type { RsvpEngine } from "@rsvp-engine/core";

export type {
  RsvpEngineOptions,
  RsvpEventType,
  RsvpItem,
  RsvpSnapshot,
  RsvpState,
  RsvpStoreListener,
  OvpStrategy,
} from "@rsvp-engine/core";

export type {
  RsvpEngineOptions as ReactRsvpEngineOptions,
  RsvpEventType as ReactRsvpEventType,
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
  engine.subscribe(() => {
    void engine.getSnapshot();
  })();
  engine.clearError();
  // @ts-expect-error The event subscription API is removed.
  engine.on("error", () => undefined);
  // @ts-expect-error Read the cached store instead.
  engine.snapshot();
  // @ts-expect-error The old Core command is removed, not retained as an alias.
  engine.setSpeed(225);
  // @ts-expect-error The old controller command is removed.
  controller.setSpeed(225);
  // @ts-expect-error The old action is removed.
  actions.setSpeed(225);
}
