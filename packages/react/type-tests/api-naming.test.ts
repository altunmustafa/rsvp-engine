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
}
