# RSVP Engine

RSVP Engine is a TypeScript monorepo for building Rapid Serial Visual Presentation (RSVP) readers, which present text one word at a time.

The packages handle playback, timing, and reading state while applications own rendering and UI. Use the same engine across environments and build a reader that fits your application's design.

## Features

- Control playback with play, pause, resume, stop, and configurable reading speed.
- Keep reading rhythm consistent with drift-corrected scheduling and preserved display time across pauses.
- Process multilingual text with Unicode-aware tokenization and calculate an optimal viewing position for word alignment.
- Customize tokenization, viewing-position strategies, and timing without coupling playback to a UI framework.

## Packages

### [`@rsvp-engine/core`](packages/core/README.md)

A zero-dependency, headless playback engine with typed events and snapshots. It runs without a DOM in browsers, Node.js, Web Workers, and React Native, so playback logic can be reused independently of rendering.

### [`@rsvp-engine/react`](packages/react/README.md)

Headless React bindings with an externally owned controller and typed context hooks. Selectors update components only when their selected state changes, while action-only controls avoid subscribing to playback updates. The application owns the controller's lifetime independently of component mounts.

See each package's README for usage and API documentation.

## Examples

Explore the [examples](examples/README.md) for browser, article-extraction, terminal, and React readers, with links to usage and running instructions.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, testing, Changesets, and pull request requirements.
