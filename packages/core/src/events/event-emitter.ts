import type { EventCallback, RSVPEventMap, RSVPEventType, UnsubscribeFn } from "./types";

type ListenerRegistry<T> = {
  [K in RSVPEventType]: Set<EventCallback<RSVPEventMap<T>[K]>>;
};

export class EventEmitter<T = string> {
  readonly #listenerRegistry: ListenerRegistry<T> = {
    stateChange: new Set(),
    itemChange: new Set(),
    complete: new Set(),
    error: new Set(),
  };

  public on<K extends RSVPEventType>(
    event: K,
    callback: EventCallback<RSVPEventMap<T>[K]>,
  ): UnsubscribeFn {
    const eventListeners = this.#listenerRegistry[event];
    eventListeners.add(callback);

    return () => {
      eventListeners.delete(callback);
    };
  }

  public emit<K extends RSVPEventType>(event: K, payload: RSVPEventMap<T>[K]): void {
    const eventListeners = this.#listenerRegistry[event];

    // Copy to array to handle safe iteration if unsubscribed during emit
    const listenersSnapshot = Array.from(eventListeners);

    for (const listener of listenersSnapshot) {
      try {
        listener(payload);
      } catch (err) {
        if (event !== "error") {
          const error = err instanceof Error ? err : new Error(String(err));
          this.emit("error", { error });
        }
      }
    }
  }

  public removeAllListeners(): void {
    for (const eventListeners of Object.values(this.#listenerRegistry)) {
      eventListeners.clear();
    }
  }
}
