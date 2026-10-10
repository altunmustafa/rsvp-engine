import { RsvpEngine, type RsvpEventType, type RsvpSnapshot, type Token } from "@rsvp-engine/core";

const tokens: Token<number>[] = [{ value: 42, ovpIndex: 0, durationMultiplier: 1 }];
const engine = new RsvpEngine<number>();
engine.loadTokens(tokens);
const store: RsvpSnapshot<number> = engine.getSnapshot();
void store;
engine.clearError();
engine.subscribe((snapshot, eventType) => {
  const value: number | undefined = snapshot.currentItem?.value;
  const error: Error | null = snapshot.error;
  const event: RsvpEventType = eventType;
  const remaining: number | null = snapshot.timing.remainingDurationMs;
  void [value, error, event, remaining];
})();
const value: number | undefined = engine.getSnapshot().currentItem?.value;
void value;
// @ts-expect-error Public item types must not degrade to any.
const invalid: string = engine.getSnapshot().currentItem?.value;
void invalid;
engine.destroy();
