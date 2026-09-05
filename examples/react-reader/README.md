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

## Manual browser check

1. Change the source text and select **Load text**.
2. Move the WPM slider and confirm its displayed value changes.
3. Select **Start** and confirm words and progress advance.
4. Confirm **Pause** preserves the current word and **Start** resumes.
5. Confirm **Stop** returns playback to the beginning.
6. Reload the page and check that keyboard focus is visible while tabbing through every control.
