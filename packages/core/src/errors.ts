/**
 * Thrown when an invalid state transition is attempted.
 *
 */
export class InvalidTransitionError extends Error {
  public readonly from: string;
  public readonly action: string;

  constructor(from: string, action: string) {
    super(`Invalid transition: cannot perform '${action}' from '${from}' state.`);
    this.name = "InvalidTransitionError";
    this.from = from;
    this.action = action;
  }
}

/**
 * Thrown when a method is called on a destroyed engine instance.
 */
export class EngineDestroyedError extends Error {
  constructor() {
    super("Cannot interact with a destroyed engine instance.");
    this.name = "EngineDestroyedError";
  }
}

/**
 * Thrown when invalid input is provided to the engine (empty text, null data, etc.).
 */
export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidInputError";
  }
}

/**
 * Thrown when a seek index is out of bounds.
 */
export class IndexOutOfBoundsError extends Error {
  public readonly index: number;
  public readonly totalItems: number;

  constructor(index: number, totalItems: number) {
    super(`Index ${index} is out of bounds (0..${totalItems - 1}).`);
    this.name = "IndexOutOfBoundsError";
    this.index = index;
    this.totalItems = totalItems;
  }
}
