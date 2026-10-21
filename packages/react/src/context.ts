import type { RsvpActions, RsvpContextBundle, RsvpController, RsvpProviderProps } from "./types";
import type { ReactElement } from "react";

import { createContext, createElement, useContext, useMemo } from "react";

import { useControllerSelector } from "./hooks";

const defaultEquality = Object.is;

/** Creates an isolated RSVP Provider and hooks with fixed item and metadata types. */
export function createRsvpContext<T = string, TMeta = unknown>(): RsvpContextBundle<T, TMeta> {
  const ControllerContext = createContext<RsvpController<T, TMeta> | null>(null);

  function RsvpProvider({ controller, children }: RsvpProviderProps<T, TMeta>): ReactElement {
    return createElement(ControllerContext.Provider, { value: controller }, children);
  }

  RsvpProvider.displayName = "RsvpProvider";

  function useRsvpController(): RsvpController<T, TMeta> {
    const controller = useContext(ControllerContext);

    if (controller === null) {
      throw new Error("RSVP context hooks must be used within their matching RsvpProvider.");
    }

    return controller;
  }

  function useRsvpSelector<Selected>(
    selector: (state: ReturnType<RsvpController<T, TMeta>["getSnapshot"]>) => Selected,
    equalityFn: (left: Selected, right: Selected) => boolean = defaultEquality,
  ): Selected {
    return useControllerSelector(useRsvpController(), selector, equalityFn);
  }

  function useRsvpActions(): RsvpActions<T, TMeta> {
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
          setWpm: controller.setWpm,
          setMsPerItem: controller.setMsPerItem,
          setOvpStrategy: controller.setOvpStrategy,
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
