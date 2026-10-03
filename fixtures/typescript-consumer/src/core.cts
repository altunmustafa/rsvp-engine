import { RsvpEngine, type Token } from "@rsvp-engine/core";

const tokens: Token<number>[] = [{ value: 42, ovpIndex: 0, delayMultiplier: 1 }];
const engine = new RsvpEngine<number>();
engine.loadTokens(tokens);
const value: number | undefined = engine.snapshot().currentItem?.value;
void value;
// @ts-expect-error Public item types must not degrade to any.
const invalid: string = engine.snapshot().currentItem?.value;
void invalid;
engine.destroy();
