import {
  DefaultOvpStrategy,
  EngineError,
  type EngineErrorOptions,
  type ErrorOptionsWithMessage,
  ItemSelectionError,
  ListenerError,
  MissingTokenizerError,
  PlaybackSchedulingError,
  RsvpEngine,
  type RsvpEventType,
  type RsvpItem,
  type RsvpSnapshot,
  type RsvpStoreListener,
  type RsvpTiming,
  SessionLoadError,
  TextTokenizer,
  type TextTokenizerOptions,
  type Token,
  TokenizationError,
  type TokenizerStrategy,
} from "@rsvp-engine/core";

const errorOptions: EngineErrorOptions = { cause: new Error("source failure"), isFatal: true };
new EngineError("Consumer failure", errorOptions);
new EngineError();
const optionsWithMessage: ErrorOptionsWithMessage = {
  message: "Consumer failure",
  cause: errorOptions.cause,
};
new ListenerError("advanced", optionsWithMessage);
const operationErrors: EngineError[] = [
  new MissingTokenizerError(optionsWithMessage),
  new TokenizationError(optionsWithMessage),
  new SessionLoadError(),
  new ItemSelectionError(1, optionsWithMessage),
  new PlaybackSchedulingError(),
];
void operationErrors;

const token: Token<string> = { value: "word", ovpIndex: 1, durationMultiplier: 1.5 };
// @ts-expect-error Token duration multipliers are readonly.
token.durationMultiplier = 2;
const textOptions: TextTokenizerOptions = {
  sentenceDurationMultiplier: 3,
  clauseDurationMultiplier: 2,
  dashDurationMultiplier: 1.5,
};
const textTokenizer = new TextTokenizer(textOptions);
const textTokens: Token<string>[] = textTokenizer.tokenize(["one two", "three"]);
const textEngine = new RsvpEngine({ tokenizer: textTokenizer });
textEngine.load(["one two", "three"]);
const textValue: string | undefined = textEngine.currentItem?.value;
void [textTokens, textValue];
textEngine.destroy();

const tokenizer: TokenizerStrategy<string> = {
  tokenize: (input) =>
    (Array.isArray(input) ? input : [input]).map((value) => ({
      value,
      ovpIndex: 0,
      durationMultiplier: 1,
    })),
};
const engine = new RsvpEngine({
  onError: (error) => {
    const failure: EngineError | ListenerError = error;
    if (failure instanceof ListenerError) {
      const event: RsvpEventType = failure.eventType;
      void event;
    } else {
      const fatal: boolean = failure.isFatal;
      void fatal;
    }
  },
  tokenizer,
  wpm: 225,
  ovpStrategy: new DefaultOvpStrategy(),
});
engine.load("one two");
engine.setWpm(425);
engine.setOvpStrategy(new DefaultOvpStrategy());
engine.setOvpStrategy(undefined);
const ovpEvent: RsvpEventType = "ovpChanged";
void ovpEvent;
const snapshot: RsvpSnapshot<string> = engine.getSnapshot();
const item: RsvpItem<string> | null = snapshot.currentItem;
const currentIndex: number = snapshot.currentIndex;
void [item, currentIndex];
const timing: RsvpTiming = snapshot.timing;
const remaining: number | null = timing.remainingDurationMs;
void remaining;
// @ts-expect-error Timing samples are readonly.
timing.sampledAtMs = 0;
const listener: RsvpStoreListener<string> = (snapshot, eventType) => {
  const value: string | undefined = snapshot.currentItem?.value;
  const event: RsvpEventType = eventType;
  void [value, event];
};
// @ts-expect-error Events describe concrete operations or playback state changes.
const invalidEvent: RsvpEventType = "unknownEvent";
void invalidEvent;
engine.subscribe(listener)();
// @ts-expect-error Observable state is readonly.
snapshot.currentIndex = 0;
const value: string | undefined = snapshot.currentItem?.value;
void value;
const multiplier: number | undefined = snapshot.currentItem?.durationMultiplier;
void multiplier;
// @ts-expect-error Public item types must not degrade to any.
const invalid: number = snapshot.currentItem?.value;
void invalid;
engine.destroy();
