import {
  RsvpEngine,
  type RsvpEngineOptions,
  type RsvpItem,
  type RsvpSnapshot,
  type RsvpStoreListener,
  TextTokenizer,
  type Token,
  type TokenizerStrategy,
} from "@rsvp-engine/core";
import { createRsvpContext, createRsvpController } from "@rsvp-engine/react";

interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

const token: Token<string, SourceSpan> = {
  value: "word",
  ovpIndex: 0,
  durationMultiplier: 1,
  meta: { start: 0, end: 4 },
};
const tokenizer: TokenizerStrategy<string, SourceSpan> = { tokenize: () => [token] };
interface ConsumerToken extends Token<string> {
  readonly applicationId: string;
}
interface ConsumerOptions extends RsvpEngineOptions<string> {
  readonly applicationId?: string;
}
const consumerToken: ConsumerToken = { ...token, applicationId: "source" };
const consumerOptions: ConsumerOptions = { applicationId: "source" };
new RsvpEngine(consumerOptions).destroy();
const engine = new RsvpEngine({ tokenizer });
const snapshot: RsvpSnapshot<string, SourceSpan> = engine.getSnapshot();
const unknownSnapshot: RsvpSnapshot<string> = snapshot;
const item: RsvpItem<string, SourceSpan> | null = snapshot.currentItem;
const start: number | undefined = engine.currentItem?.meta?.start;
const listener: RsvpStoreListener<string, SourceSpan> = (state) => {
  const span: SourceSpan | undefined = state.currentItem?.meta;
  void span;
};
engine.subscribe(listener)();
const unknownListener: RsvpStoreListener<string> = () => undefined;
engine.subscribe(unknownListener)();
engine.loadTokens([token]);
// @ts-expect-error Required metadata cannot be omitted from pre-tokenized input.
engine.loadTokens([{ value: "no metadata", ovpIndex: 0, durationMultiplier: 1 }]);
// @ts-expect-error Metadata cannot widen through a later load.
engine.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { id: 1 } }]);
// @ts-expect-error The metadata field is readonly.
token.meta = { start: 1, end: 5 };
// @ts-expect-error An empty session still has no current item.
const requiredSpan: SourceSpan = engine.currentItem?.meta;
if (item !== null) {
  const required: SourceSpan = item.meta;
  void required;
}
const options: RsvpEngineOptions<string, SourceSpan> = { tokenizer };
const explicit = new RsvpEngine<string, SourceSpan>(options);
explicit.load("the custom tokenizer supplies metadata");
explicit.loadTokens([token]);
const pretokenized = new RsvpEngine<string, SourceSpan>();
pretokenized.loadTokens([token]);
// @ts-expect-error A tokenizer-free engine still requires its declared metadata.
pretokenized.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
// @ts-expect-error A later load cannot widen the explicit metadata type.
pretokenized.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: false }]);
// @ts-expect-error Tokens must carry metadata when its type excludes undefined.
const missingMetadata: Token<string, SourceSpan> = {
  value: "word",
  ovpIndex: 0,
  durationMultiplier: 1,
};
const undefinedMetadata: Token<string, SourceSpan> = {
  value: "word",
  ovpIndex: 0,
  durationMultiplier: 1,
  // @ts-expect-error Required metadata cannot be explicitly undefined.
  meta: undefined,
};
const defaultTokenizer = new RsvpEngine<string, SourceSpan>({
  // @ts-expect-error The default tokenizer cannot supply required metadata.
  tokenizer: new TextTokenizer(),
});
const optional = new RsvpEngine<string, SourceSpan | undefined>();
optional.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
optional.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: undefined }]);
optional.loadTokens([token]);
new RsvpEngine<string, SourceSpan | undefined>({
  tokenizer: new TextTokenizer(),
}).destroy();
const unknown = new RsvpEngine({ tokenizer: new TextTokenizer() });
unknown.loadTokens([token]);
// @ts-expect-error The default tokenizer does not infer a metadata shape.
const unknownStart: unknown = unknown.currentItem?.meta?.start;
const partial = new RsvpEngine<string>({ tokenizer });
// @ts-expect-error Specifying only T leaves metadata unknown.
const partialStart: unknown = partial.currentItem?.meta?.start;
const controller = createRsvpController<string, SourceSpan>({ tokenizer });
createRsvpController<string, SourceSpan>({
  // @ts-expect-error The React factory also rejects metadata-free tokenizers for required metadata.
  tokenizer: new TextTokenizer(),
}).destroy();
const optionalController = createRsvpController<string, SourceSpan | undefined>({
  tokenizer: new TextTokenizer(),
});
optionalController.destroy();
const { useRsvpSelector, useRsvpActions } = createRsvpContext<string, SourceSpan>();
const selectedStart: number | undefined = useRsvpSelector(
  (state) => state.currentItem?.meta?.start,
);
useRsvpActions().loadTokens([token]);
// @ts-expect-error React actions preserve the metadata type in emitted declarations.
useRsvpActions().loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: false }]);
void [
  item,
  start,
  requiredSpan,
  defaultTokenizer,
  unknownStart,
  partialStart,
  selectedStart,
  missingMetadata,
  undefinedMetadata,
  unknownSnapshot,
  consumerToken,
];
engine.destroy();
explicit.destroy();
pretokenized.destroy();
defaultTokenizer.destroy();
optional.destroy();
unknown.destroy();
partial.destroy();
controller.destroy();
