/** Environment-neutral subset of global runtime capabilities used by the default time driver. */
export interface RuntimeGlobal {
  readonly performance?: {
    readonly now?: () => number;
  };
  readonly setTimeout?: (callback: () => void, ms: number) => unknown;
  readonly clearTimeout?: (handle: unknown) => void;
}
