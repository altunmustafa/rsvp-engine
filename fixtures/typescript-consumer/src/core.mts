import {
  DefaultTokenizer,
  RsvpEngine,
  type RsvpEventType,
  type RsvpSnapshot,
  type RsvpStoreListener,
  type RsvpTiming,
  type Token,
} from "@rsvp-engine/core";

const token: Token<string> = { value: "word", ovpIndex: 1, durationMultiplier: 1.5 };
// @ts-expect-error Token duration multipliers are readonly.
token.durationMultiplier = 2;
new DefaultTokenizer({
  sentenceDurationMultiplier: 3,
  clauseDurationMultiplier: 2,
  dashDurationMultiplier: 1.5,
});

const engine = new RsvpEngine({ data: "one two", wpm: 225 });
engine.setWpm(425);
const snapshot: RsvpSnapshot<string> = engine.getSnapshot();
const timing: RsvpTiming = snapshot.timing;
const remaining: number | null = timing.remainingDurationMs;
void remaining;
// @ts-expect-error Timing samples are readonly.
timing.sampledAtMs = 0;
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
const value: string | undefined = snapshot.currentItem?.value;
void value;
const multiplier: number | undefined = snapshot.currentItem?.durationMultiplier;
void multiplier;
// @ts-expect-error Public item types must not degrade to any.
const invalid: number = snapshot.currentItem?.value;
void invalid;
engine.destroy();
