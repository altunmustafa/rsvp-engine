import { RsvpEngine, type Token, type TokenizerStrategy } from "@rsvp-engine/core";
import {
  type RsvpActions,
  type RsvpController,
  type RsvpControllerOptions,
  type RsvpControllerSnapshot,
  type RsvpProviderProps,
  type RsvpSelector,
  createRsvpContext,
  createRsvpController,
} from "@rsvp-engine/react";

interface Metadata {
  readonly id: string;
}

const token: Token<number, Metadata> = {
  value: 42,
  ovpIndex: 0,
  durationMultiplier: 1,
  meta: { id: "answer" },
};
const tokenizer: TokenizerStrategy<number, Metadata> = { tokenize: () => [token] };
const engine = new RsvpEngine<number, Metadata>();
engine.loadTokens([token]);
const options: RsvpControllerOptions<number, Metadata> = { tokenizer };
const controller = createRsvpController(options);
const typedController: RsvpController<number, Metadata> = controller;
const snapshot: RsvpControllerSnapshot<number, Metadata> = controller.getSnapshot();
const props: RsvpProviderProps<number, Metadata> = { controller };
const id: string | undefined = snapshot.currentItem?.meta?.id;
controller.subscribe((state) => {
  const meta: Metadata | undefined = state.currentItem?.meta;
  void meta;
})();
const { useRsvpSelector, useRsvpActions, useRsvpController } = createRsvpContext<
  number,
  Metadata
>();
const selector: RsvpSelector<number, string | undefined, Metadata> = (state) =>
  state.currentItem?.meta?.id;
const selectedId: string | undefined = useRsvpSelector(selector);
const actions: RsvpActions<number, Metadata> = useRsvpActions();
const selectedController: RsvpController<number, Metadata> = useRsvpController();
actions.loadTokens([token]);
// @ts-expect-error Required metadata cannot be omitted through React actions.
actions.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1 }]);
// @ts-expect-error Tokenizer-free construction preserves required metadata.
engine.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1 }]);
if (snapshot.currentItem !== null) {
  const meta: Metadata = snapshot.currentItem.meta;
  void meta;
}
const optional = createRsvpController<number, Metadata | undefined>();
optional.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1 }]);
optional.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1, meta: undefined }]);
optional.loadTokens([token]);
// @ts-expect-error Inferred controller metadata cannot change shape.
controller.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1, meta: { start: 0 } }]);
// @ts-expect-error Selector metadata types must not degrade to any.
const invalid: number = useRsvpSelector(selector);
const unknown = createRsvpController();
unknown.loadTokens([{ value: "word", ovpIndex: 0, durationMultiplier: 1, meta: null }]);
// @ts-expect-error Unspecified metadata requires narrowing.
const unknownId: unknown = unknown.getSnapshot().currentItem?.meta?.id;
const primitive = new RsvpEngine<number, boolean>({
  tokenizer: { tokenize: () => [{ value: 42, ovpIndex: 0, durationMultiplier: 1, meta: false }] },
});
primitive.loadTokens([{ value: 42, ovpIndex: 0, durationMultiplier: 1, meta: false }]);
void [typedController, props, id, selectedId, selectedController, invalid, unknownId];
engine.destroy();
controller.destroy();
unknown.destroy();
optional.destroy();
primitive.destroy();
