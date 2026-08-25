# Core Architecture Decision Records

Core ADRs use the Michael Nygard sections `Status`, `Context`, `Decision`, and `Consequences`, with the decision date directly below the title. Add a record only for an important, durable architectural decision and assign the next four-digit number.

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-0001](./0001-zero-dependency-headless-core.md) | Accepted | Keep core zero-dependency and headless. |
| [ADR-0002](./0002-drift-corrected-scheduling.md) | Accepted | Correct ordinary timer drift and rebase after large delays. |
| [ADR-0003](./0003-synchronous-tokenization-boundary.md) | Accepted | Keep asynchronous tokenization outside core. |
| [ADR-0004](./0004-dependency-injection-boundaries.md) | Accepted | Inject time, scheduling, and tokenization at explicit boundaries. |
| [ADR-0005](./0005-unicode-segmentation-fallbacks.md) | Accepted | Prefer platform Unicode segmentation with dependency-free fallbacks. |
| [ADR-0006](./0006-pause-resume-remaining-time.md) | Accepted | Preserve the current item's remaining time across pause and resume. |
