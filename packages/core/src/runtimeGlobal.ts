/** Environment-neutral subset of global runtime capabilities used by Core. */
export interface RuntimeGlobal {
  readonly queueMicrotask?: (callback: () => void) => void;
  readonly performance?: {
    readonly now?: () => number;
  };
  readonly setTimeout?: (callback: () => void, ms: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
}
