import type { RsvpContextBundle, RsvpController, RsvpProviderProps } from "./types";
import type { ReactElement } from "react";

import { createContext, createElement, useContext, useMemo } from "react";

import { useControllerSelector } from "./hooks";

const defaultEquality = Object.is;

/** Creates an isolated, item-type-safe RSVP Provider and consumer hook pair. */
export function createRsvpContext<T = string>(): RsvpContextBundle<T> {
  const ControllerContext = createContext<RsvpController<T> | null>(null);

  function RsvpProvider({ controller, children }: RsvpProviderProps<T>): ReactElement {
    return createElement(ControllerContext.Provider, { value: controller }, children);
  }

  RsvpProvider.displayName = "RsvpProvider";

  function useRsvpController(): RsvpController<T> {
    const controller = useContext(ControllerContext);

    if (controller === null) {
      throw new Error("RSVP context hooks must be used within their matching RsvpProvider.");
    }

    return controller;
  }

  function useRsvpSelector<Selected>(
    selector: (state: ReturnType<RsvpController<T>["getSnapshot"]>) => Selected,
    equalityFn: (left: Selected, right: Selected) => boolean = defaultEquality,
  ): Selected {
    return useControllerSelector(useRsvpController(), selector, equalityFn);
  }

  function useRsvpActions() {
    const controller = useRsvpController();

    return useMemo(
      () =>
        Object.freeze({
          play: controller.play,
          pause: controller.pause,
          stop: controller.stop,
          seek: controller.seek,
          next: controller.next,
          previous: controller.previous,
          reset: controller.reset,
          load: controller.load,
          loadTokens: controller.loadTokens,
          setSpeed: controller.setSpeed,
          setMsPerItem: controller.setMsPerItem,
          clearError: controller.clearError,
        }),
      [controller],
    );
  }

  return Object.freeze({
    RsvpProvider,
    useRsvpSelector,
    useRsvpActions,
    useRsvpController,
  });
}
