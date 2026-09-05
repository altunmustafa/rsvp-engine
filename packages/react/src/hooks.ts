import type { RsvpController, RsvpControllerSnapshot, RsvpEqualityFn, RsvpSelector } from "./types";

import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

/** Subscribes to a controller while exposing only an observably selected value. */
export function useControllerSelector<T, Selected>(
  controller: RsvpController<T>,
  selector: RsvpSelector<T, Selected>,
  equalityFn: RsvpEqualityFn<Selected>,
): Selected {
  return useSyncExternalStoreWithSelector<RsvpControllerSnapshot<T>, Selected>(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
    selector,
    equalityFn,
  );
}
