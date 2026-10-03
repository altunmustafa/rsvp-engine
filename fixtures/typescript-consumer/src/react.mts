import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

const controller = createRsvpController({ data: "one two", wpm: 225 });
const { useRsvpSelector, useRsvpActions } = createRsvpContext<string>();
const speed: number = useRsvpSelector(({ snapshot }) => snapshot.wpm);
useRsvpActions().setWpm(speed);
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector(({ snapshot }) => snapshot.wpm);
void invalid;
controller.destroy();
