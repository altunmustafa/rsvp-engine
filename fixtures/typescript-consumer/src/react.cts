import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController<number>();
controller.loadTokens([{ value: 42, ovpIndex: 0, delayMultiplier: 1 }]);
const { useRsvpSelector, useRsvpController } = createRsvpContext<number>();
const value: number | undefined = useRsvpSelector(({ snapshot }) => snapshot.currentItem?.value);
void value;
useRsvpController().setWpm(225);
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector(({ snapshot }) => snapshot.currentItem?.value);
void invalid;
controller.destroy();
