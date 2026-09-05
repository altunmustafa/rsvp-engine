# React Architecture Decision Records

React ADRs use the Michael Nygard sections `Status`, `Context`, `Decision`, and `Consequences`, with the decision date directly below the title.

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](./0001-own-core-with-a-cached-external-store.md) | Accepted | Own one Core engine behind a cached external store with explicit lifetime. |
| [ADR-0002](./0002-use-context-bound-selectors-and-actions.md) | Accepted | Require Context-bound selective reads backed by React's official selector implementation, stable actions, and a controller escape hatch. |
