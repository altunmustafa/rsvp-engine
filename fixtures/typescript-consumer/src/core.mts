import { RsvpEngine, type RsvpSnapshot } from "@rsvp-engine/core";

const engine = new RsvpEngine({ data: "one two", wpm: 225 });
engine.setWpm(425);
const snapshot: RsvpSnapshot<string> = engine.snapshot();
const value: string | undefined = snapshot.currentItem?.value;
void value;
// @ts-expect-error Public item types must not degrade to any.
const invalid: number = snapshot.currentItem?.value;
void invalid;
engine.destroy();
