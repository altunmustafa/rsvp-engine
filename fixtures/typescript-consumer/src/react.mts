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
  new TokenizationError(optionsWithMessage),
  new SessionLoadError(),
  new ItemSelectionError(1, optionsWithMessage),
  new PlaybackSchedulingError(),
];
void operationErrors;

const controller = createRsvpController({
  tokenizer: new DefaultTokenizer<string>(),
  wpm: 225,
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
controller.load("one two");
controller.subscribe((snapshot, eventType) => {
  const event: RsvpEventType = eventType;
  void [snapshot.currentItem?.value, event];
})();
const { useRsvpSelector, useRsvpActions } = createRsvpContext<string>();
const speed: number = useRsvpSelector((snapshot) => snapshot.wpm);
const remaining: number | null = useRsvpSelector((snapshot) => snapshot.timing.remainingDurationMs);
void remaining;
useRsvpActions().setWpm(speed);
useRsvpActions().setOvpStrategy({ calculate: () => 0 });
controller.setOvpStrategy({ calculate: () => 0 });
// @ts-expect-error Selector result types must not degrade to any.
const invalid: string = useRsvpSelector((snapshot) => snapshot.wpm);
void invalid;
controller.destroy();
