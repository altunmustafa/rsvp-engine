import type { RsvpEventType, RsvpSnapshot, RsvpStoreListener, UnsubscribeFn } from "./types";

import { ListenerError, UndeliveredError } from "../errors";

interface StoreNotification<T, TMeta> {
  readonly snapshot: RsvpSnapshot<T, TMeta>;
  readonly eventType: RsvpEventType;
}

/** Internal synchronous delivery of captured snapshots, including nested publications. */
export class Notifier<T, TMeta> {
  readonly #listeners = new Set<RsvpStoreListener<T, TMeta>>();
  readonly #queue: StoreNotification<T, TMeta>[] = [];
  readonly #reportError: (error: ListenerError) => void;
  #notifying = false;
  #destroyed = false;

  constructor(reportError: (error: ListenerError) => void) {
    this.#reportError = reportError;
  }

  /** Registers a listener without immediately calling it. */
  public subscribe(listener: RsvpStoreListener<T, TMeta>): UnsubscribeFn {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Ends active delivery and releases listeners and queued snapshots. */
  public destroy(): void {
    this.#destroyed = true;
    this.#listeners.clear();
    this.#queue.length = 0;
  }

  /** Queues a captured snapshot and drains notifications in publication order. */
  public publish(snapshot: RsvpSnapshot<T, TMeta>, eventType: RsvpEventType): void {
    this.#queue.push({ snapshot, eventType });
    if (this.#notifying) {
      return;
    }
    this.#notifying = true;
    let reportingFailures: UndeliveredError[] | undefined;
    try {
      while (this.#queue.length && !this.#destroyed) {
        const notification = this.#queue.shift()!;
        for (const listener of Array.from(this.#listeners)) {
          if (this.#destroyed) {
            break;
          }
          try {
            listener(notification.snapshot, notification.eventType);
          } catch (error) {
            try {
              this.#reportError(new ListenerError(notification.eventType, { cause: error }));
            } catch (reportingError) {
              if (!(reportingError instanceof UndeliveredError)) {
                throw reportingError;
              }
              (reportingFailures ??= []).push(reportingError);
            }
          }
        }
      }
    } finally {
      this.#queue.length = 0;
      this.#notifying = false;
    }
    if (reportingFailures) {
      throw reportingFailures.length === 1
        ? reportingFailures[0]
        : new UndeliveredError(reportingFailures);
    }
  }
}
