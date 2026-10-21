import type {
  RsvpActions,
  RsvpController,
  RsvpControllerSnapshot,
  RsvpEventType,
  RsvpSnapshot,
  RsvpTiming,
} from "../src";
import type { ReactNode } from "react";

import { DefaultTokenizer } from "@rsvp-engine/core";

import { createRsvpContext, createRsvpController } from "../src";

const numberController = createRsvpController({
  tokenizer: new DefaultTokenizer<number>(),
});
numberController.load([1, 2, 3]);
const stringController = createRsvpController({
  tokenizer: new DefaultTokenizer<string>(),
});
stringController.load("one two");
const typedController: RsvpController<number> = numberController;
const coreStore: RsvpSnapshot<number> = typedController.getSnapshot();
const controllerStore: RsvpControllerSnapshot<number> = coreStore;
const timing: RsvpTiming = controllerStore.timing;
void timing;
numberController.subscribe((snapshot, eventType) => {
  const value: number | undefined = snapshot.currentItem?.value;
  const multiplier: number | undefined = snapshot.currentItem?.durationMultiplier;
  const event: RsvpEventType = eventType;
  void [value, event, multiplier];
  // @ts-expect-error The subscriber receives readonly Core state.
  snapshot.currentIndex = 0;
});
const { RsvpProvider, useRsvpActions, useRsvpController, useRsvpSelector } =
  createRsvpContext<number>();

const validProvider = <RsvpProvider controller={numberController} />;
// @ts-expect-error The context factory fixes the controller item type to number.
const invalidProvider = <RsvpProvider controller={stringController} />;

function NumberConsumer(): ReactNode {
  const currentValue: number | undefined = useRsvpSelector(
    (snapshot) => snapshot.currentItem?.value,
  );
  const remaining: number | null = useRsvpSelector(
    (snapshot) => snapshot.timing.remainingDurationMs,
  );
  void remaining;
  const actions: RsvpActions<number> = useRsvpActions();
  const controller: RsvpController<number> = useRsvpController();
  actions.load([4, 5]);
  controller.setWpm(600);
  // @ts-expect-error Number actions cannot load string data.
  actions.load("invalid");
  return currentValue ?? null;
}

void [typedController, controllerStore, validProvider, invalidProvider, NumberConsumer];
