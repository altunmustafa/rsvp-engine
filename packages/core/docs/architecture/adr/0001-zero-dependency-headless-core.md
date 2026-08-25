# ADR-0001: Keep Core Zero-Dependency and Headless

- Date: 2026-08-19

## Status

Accepted

## Context

The core engine must run consistently in browsers, Node.js, Web Workers, React Native, and other JavaScript hosts. Production dependencies increase bundle size and compatibility risk, while DOM APIs would bind the engine to browser UI concerns.

## Decision

Keep `@rsvp-engine/core` free of production dependencies and DOM APIs. Rendering, document parsing, visibility handling, persistence, and other host concerns belong in adapters or wrapper packages. Use only environment-neutral capabilities or explicit injected abstractions inside core.

## Consequences

Core remains portable, deterministic, and small enough for the 5 KB gzip budget. Features that require DOM access or external libraries must live outside core, and core may need compact platform feature detection or dependency-free fallbacks.
