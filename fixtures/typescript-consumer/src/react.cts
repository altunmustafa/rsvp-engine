import { type RsvpEventType, createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController<number>();
controller.subscribe((snapshot, eventType) => {
  const event: RsvpEventType = eventType;
  const value: number | undefined = snapshot.currentItem?.value;
  const remaining: number | null = snapshot.timing.remainingDurationMs;
  void [value, event, remaining];
})();
controller.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1 }]);
const { useRsvpSelector, useRsvpController } = createRsvpContext<number>();
const value: number | undefined = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
void value;
useRsvpController().setWpm(225);
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
void invalid;
controller.destroy();
