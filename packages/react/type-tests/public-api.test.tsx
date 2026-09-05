import type { RsvpActions, RsvpController } from "../src";
import type { ReactNode } from "react";

import { createRsvpContext, createRsvpController } from "../src";

const numberController = createRsvpController({ data: [1, 2, 3] });
const stringController = createRsvpController({ data: "one two" });
const typedController: RsvpController<number> = numberController;
const { RsvpProvider, useRsvpActions, useRsvpController, useRsvpSelector } =
  createRsvpContext<number>();

const validProvider = <RsvpProvider controller={numberController} />;
// @ts-expect-error The context factory fixes the controller item type to number.
const invalidProvider = <RsvpProvider controller={stringController} />;

function NumberConsumer(): ReactNode {
  const currentValue: number | undefined = useRsvpSelector(
    ({ snapshot }) => snapshot.currentItem?.value,
  );
  const actions: RsvpActions<number> = useRsvpActions();
  const controller: RsvpController<number> = useRsvpController();
  actions.load([4, 5]);
  controller.setSpeed(600);
  // @ts-expect-error Number actions cannot load string data.
  actions.load("invalid");
  return currentValue ?? null;
}

void [typedController, validProvider, invalidProvider, NumberConsumer];
