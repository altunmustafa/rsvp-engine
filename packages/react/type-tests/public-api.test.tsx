import type {
  RsvpActions,
  RsvpController,
  RsvpControllerSnapshot,
  RsvpEventType,
  RsvpSnapshot,
} from "../src";
import type { ReactNode } from "react";

import { createRsvpContext, createRsvpController } from "../src";

const numberController = createRsvpController({ data: [1, 2, 3] });
const stringController = createRsvpController({ data: "one two" });
const typedController: RsvpController<number> = numberController;
const coreStore: RsvpSnapshot<number> = typedController.getSnapshot();
const controllerStore: RsvpControllerSnapshot<number> = coreStore;
numberController.subscribe((snapshot, eventType) => {
  const value: number | undefined = snapshot.currentItem?.value;
  const error: Error | null = snapshot.error;
  const event: RsvpEventType = eventType;
  void [value, error, event];
  // @ts-expect-error The subscriber receives readonly Core state.
  snapshot.error = null;
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
  const actions: RsvpActions<number> = useRsvpActions();
  const controller: RsvpController<number> = useRsvpController();
  actions.load([4, 5]);
  controller.setWpm(600);
  // @ts-expect-error Number actions cannot load string data.
  actions.load("invalid");
  return currentValue ?? null;
}

void [typedController, controllerStore, validProvider, invalidProvider, NumberConsumer];
