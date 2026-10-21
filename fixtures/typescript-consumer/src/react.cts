import { DefaultTokenizer } from "@rsvp-engine/core";
import {
  EngineError,
  type EngineErrorOptions,
  type ErrorOptionsWithMessage,
  ItemSelectionError,
  ListenerError,
  MissingTokenizerError,
  PlaybackSchedulingError,
  type RsvpEventType,
  SessionLoadError,
  TokenizationError,
  createRsvpContext,
  createRsvpController,
} from "@rsvp-engine/react";

const errorOptions: EngineErrorOptions = { cause: new Error("source failure"), isFatal: true };
new EngineError("Consumer failure", errorOptions);
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

const controller = createRsvpController<number>({
  tokenizer: new DefaultTokenizer<number>(),
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
useRsvpController().setOvpStrategy({ calculate: () => 0 });
controller.setOvpStrategy({ calculate: () => 0 });
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector((snapshot) => snapshot.currentItem?.value);
void invalid;
controller.destroy();
