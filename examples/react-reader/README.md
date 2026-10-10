# React reader example

A small browser example for the context-first `@rsvp-engine/react` API. It demonstrates `RsvpProvider`, selective state reads with `useRsvpSelector`, and non-reactive commands with `useRsvpActions`.

## Run it

From the repository root:

```bash
pnpm install
pnpm dev --filter=@rsvp-engine/example-react-reader
```

Open the local URL printed by Vite.

## Ownership

The application bootstrap owns the controller and releases it together with the React root.

The timing display selects Core's duration samples and uses the same injected `TimeDriver` for a countdown refreshed once per second while playing. Pausing freezes remaining time; stopping restores the full estimate. The timer is scoped to the timing component and cleaned up on pause or unmount. See [Core duration semantics](../../packages/core/docs/API-REFERENCE.md#duration-estimates).

## Manual browser check

1. Change the source text and select **Load text**.
2. Move the WPM slider and confirm its displayed value changes.
3. Select **Start** and confirm words and progress advance while remaining time decreases.
4. Confirm **Pause** preserves the current word and remaining time; **Start** resumes.
5. Confirm **Stop** returns playback to the beginning and restores remaining time to total time.
6. Change speed during playback or pause and confirm duration estimates update. Completion shows zero remaining time.
7. Reload the page and check that keyboard focus is visible while tabbing through every control.
