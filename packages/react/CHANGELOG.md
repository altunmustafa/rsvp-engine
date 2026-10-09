# @rsvp-engine/react

## 0.1.2

### Patch Changes

- 66fa040: Clarify that stop() is valid only while playing or paused, retains loaded data, and reports invalid transitions for repeated or completed-session calls. Document the observable error behavior without changing playback.
- Updated dependencies [66fa040]
  - @rsvp-engine/core@1.0.3

## 0.1.1

### Patch Changes

- dc9b6f1: Reject non-integer and non-finite seek indices without changing playback state, selection, or timing. Document seek index requirements and recoverable errors in Core and React.
- Updated dependencies [dc9b6f1]
  - @rsvp-engine/core@1.0.2

## 0.1.0

### Minor Changes

- 411a630: Introduce headless React bindings with an externally owned RSVP controller, typed context, selective subscriptions, and stable playback actions. Support React 18 and 19, server rendering and hydration, and DOM-free integration through ESM, CommonJS, and TypeScript exports.
