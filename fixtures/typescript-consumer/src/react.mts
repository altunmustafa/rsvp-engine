import { type RsvpEventType, createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController({ data: "one two", wpm: 225 });
controller.subscribe((snapshot, eventType) => {
  const event: RsvpEventType = eventType;
  void [snapshot.currentItem?.value, event];
})();
const { useRsvpSelector, useRsvpActions } = createRsvpContext<string>();
const speed: number = useRsvpSelector((snapshot) => snapshot.wpm);
const remaining: number | null = useRsvpSelector((snapshot) => snapshot.timing.remainingDurationMs);
void remaining;
useRsvpActions().setWpm(speed);
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector((snapshot) => snapshot.wpm);
void invalid;
controller.destroy();
