# ADR-0004: Expose Core through a dedicated package subpath

- Date: 2026-10-21

## Status

Accepted

## Context

Applications must explicitly choose a tokenizer for raw input. React already depends on Core, but exposes only selected Core types, errors, and constants at its root. Applications therefore need a second direct RSVP dependency for concrete strategies and must learn two overlapping export surfaces. Adding more selected exports would keep that distinction inconsistent.

## Decision

We will expose Core's complete public API through `@rsvp-engine/react/core`. This entry forwards the installed Core dependency and does not bundle another copy or import React. The React root exports controller and context bindings and their types; Core types, errors, and constants move to the subpath.

## Consequences

React applications can use one direct RSVP dependency with separate import paths for bindings and Core APIs. Existing Core imports from the React root require migration. The subpath preserves the resolved dependency's constructors and types, and its public contract follows the Core version shipped with the React package. Framework-independent consumers continue to use Core directly.
