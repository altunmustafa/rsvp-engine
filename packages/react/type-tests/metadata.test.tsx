import type {
  RsvpActions,
  RsvpContextBundle,
  RsvpController,
  RsvpControllerOptions,
  RsvpControllerSnapshot,
  RsvpProviderProps,
  RsvpSelector,
  RsvpStoreListener,
  TokenizerStrategy,
  UseRsvpSelector,
} from "../src";

import { createRsvpContext, createRsvpController } from "../src";

interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

const tokenizer: TokenizerStrategy<string, SourceSpan> = {
  tokenize: () => [
    { value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 4 } },
  ],
};
const options: RsvpControllerOptions<string, SourceSpan> = { tokenizer };
const controller: RsvpController<string, SourceSpan> = createRsvpController(options);
const inferred = createRsvpController({ tokenizer });
const inferredStart: number | undefined = inferred.getSnapshot().currentItem?.meta?.start;
const explicit = createRsvpController<string, SourceSpan>();
explicit.loadTokens([
  { value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 4 } },
]);
// @ts-expect-error A tokenizer-free controller still requires its declared metadata.
explicit.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
const optional = createRsvpController<string, SourceSpan | undefined>();
optional.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
optional.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: undefined }]);
optional.loadTokens([
  { value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 4 } },
]);
const item = explicit.getSnapshot().currentItem;
if (item !== null) {
  const span: SourceSpan = item.meta;
  void span;
}
const missingMetadata: TokenizerStrategy<string, SourceSpan> = {
  // @ts-expect-error A tokenizer for required metadata cannot omit it.
  tokenize: () => [{ value: "word", ovpIndex: 0, durationMultiplier: 1 }],
};
// @ts-expect-error The controller metadata type cannot widen after construction.
inferred.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: "invalid" }]);
const snapshot: RsvpControllerSnapshot<string, SourceSpan> = controller.getSnapshot();
const listener: RsvpStoreListener<string, SourceSpan> = (state) => {
  const span: SourceSpan | undefined = state.currentItem?.meta;
  void span;
};
controller.subscribe(listener)();

const bundle: RsvpContextBundle<string, SourceSpan> = createRsvpContext<string, SourceSpan>();
const { RsvpProvider, useRsvpActions, useRsvpController, useRsvpSelector } = bundle;
const props: RsvpProviderProps<string, SourceSpan> = { controller };
const provider = <RsvpProvider {...props} />;
// @ts-expect-error A context requiring metadata cannot accept an optional-metadata controller.
const optionalProvider = <RsvpProvider controller={optional} />;
const incompatible = createRsvpController({
  tokenizer: {
    tokenize: () => [{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { id: 1 } }],
  },
});
// @ts-expect-error The Provider requires compatible metadata as well as item values.
const invalidProvider = <RsvpProvider controller={incompatible} />;
const selector: RsvpSelector<string, number | undefined, SourceSpan> = (state) =>
  state.currentItem?.meta?.start;
const typedSelectorHook: UseRsvpSelector<string, SourceSpan> = useRsvpSelector;

export function useMetadata(): number | undefined {
  const actions: RsvpActions<string, SourceSpan> = useRsvpActions();
  const selectedController: RsvpController<string, SourceSpan> = useRsvpController();
  actions.loadTokens([
    { value: "word", ovpIndex: 0, durationMultiplier: 1, meta: { start: 0, end: 4 } },
  ]);
  // @ts-expect-error Context actions require metadata when its type excludes undefined.
  actions.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1 }]);
  // @ts-expect-error Context actions preserve the fixed metadata type.
  actions.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: false }]);
  const span: SourceSpan | undefined = useRsvpSelector((state) => state.currentItem?.meta);
  // @ts-expect-error Selector result types must not degrade to any.
  const invalid: string = useRsvpSelector(selector);
  void [selectedController, span, invalid];
  return typedSelectorHook(selector);
}

const unknownController = createRsvpController();
unknownController.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: 42 }]);
// @ts-expect-error Unspecified metadata must be narrowed before use.
const unknownStart = unknownController.getSnapshot().currentItem?.meta?.start;
const partial = createRsvpController<string>({ tokenizer });
// @ts-expect-error An explicit item type alone leaves metadata at its unknown default.
const partialStart = partial.getSnapshot().currentItem?.meta?.start;
void [
  snapshot,
  inferredStart,
  provider,
  invalidProvider,
  optionalProvider,
  unknownStart,
  partialStart,
  missingMetadata,
];
