# Core terminal reader

A minimal Node.js example for `@rsvp-engine/core`. It renders each word on one terminal line, keeps its optimal viewing position in the center column, and distinguishes that character with a subtle gray ANSI color.

Run the default text from the repository root:

```bash
pnpm --filter @rsvp-engine/example-core-terminal-reader start
```

Or provide your own text and reading speed:

```bash
pnpm --filter @rsvp-engine/example-core-terminal-reader start --text "Read this text one word at a time." --wpm 350
```

`--text` defaults to the built-in sample and `--wpm` defaults to `300`.

The example imports only the public `@rsvp-engine/core` package API and uses no runtime dependency beyond Core.
