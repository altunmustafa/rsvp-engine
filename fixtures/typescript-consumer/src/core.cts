import {
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
  SessionLoadError,
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
  new TokenizationError(),
  new SessionLoadError(optionsWithMessage),
  new ItemSelectionError(1),
  new PlaybackSchedulingError(optionsWithMessage),
];
void operationErrors;

const tokens: Token<number>[] = [{ value: 42, ovpIndex: 0, durationMultiplier: 1 }];
const tokenizer: TokenizerStrategy<number> = { tokenize: () => tokens };
const engine = new RsvpEngine<number>({
  tokenizer,
  ovpStrategy: { calculate: () => 0 },
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
});
engine.loadTokens(tokens);
engine.setOvpStrategy({ calculate: (text) => Math.max(0, text.length - 1) });
engine.setOvpStrategy(undefined);
const store: RsvpSnapshot<number> = engine.getSnapshot();
const item: RsvpItem<number> | null = store.currentItem;
const currentIndex: number = store.currentIndex;
void [item, currentIndex];
engine.subscribe((snapshot, eventType) => {
  const value: number | undefined = snapshot.currentItem?.value;
  const event: RsvpEventType = eventType;
  const remaining: number | null = snapshot.timing.remainingDurationMs;
  void [value, event, remaining];
})();
const value: number | undefined = engine.getSnapshot().currentItem?.value;
void value;
// @ts-expect-error Public item types must not degrade to any.
const invalid: string = engine.getSnapshot().currentItem?.value;
void invalid;
engine.destroy();
