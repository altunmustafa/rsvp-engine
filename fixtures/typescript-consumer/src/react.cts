import { type RsvpEventType, createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController<number>();
controller.subscribe((snapshot, eventType) => {
  const event: RsvpEventType = eventType;
  const value: number | undefined = snapshot.currentItem?.value;
  void [value, event];
})();
controller.loadTokens([{ value: 42, ovpIndex: 0, delayMultiplier: 1 }]);
const { useRsvpSelector, useRsvpController } = createRsvpContext<number>();
const value: number | undefined = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
void value;
useRsvpController().setWpm(225);
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
void invalid;
controller.destroy();
