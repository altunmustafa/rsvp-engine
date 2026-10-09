import {
  RsvpEngine,
  type RsvpEventType,
  type RsvpSnapshot,
  type RsvpStoreListener,
} from "@rsvp-engine/core";

const engine = new RsvpEngine({ data: "one two", wpm: 225 });
engine.setWpm(425);
const snapshot: RsvpSnapshot<string> = engine.getSnapshot();
const listener: RsvpStoreListener<string> = (snapshot, eventType) => {
  const value: string | undefined = snapshot.currentItem?.value;
  const error: Error | null = snapshot.error;
  const event: RsvpEventType = eventType;
  void [value, error, event];
};
// @ts-expect-error Events describe concrete operations, not changed fields.
const invalidEvent: RsvpEventType = "stateChanged";
void invalidEvent;
engine.subscribe(listener)();
const error: Error | null = snapshot.error;
void error;
// @ts-expect-error Observable state is readonly.
snapshot.error = null;
// @ts-expect-error The old event API is removed.
void engine.on;
// @ts-expect-error The old snapshot method is removed.
void engine.snapshot;
const value: string | undefined = snapshot.currentItem?.value;
void value;
// @ts-expect-error Public item types must not degrade to any.
const invalid: number = snapshot.currentItem?.value;
void invalid;
engine.destroy();
