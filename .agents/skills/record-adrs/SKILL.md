---
name: record-adrs
description: Record or update architecture decision records. Use when a decision materially constrains architecture, public contracts, portability, dependencies, runtime behavior, or another long-lived design boundary whose rationale future maintainers will need.
---

# Record ADRs

## Overview

- Write an ADR only for important, durable decisions with meaningful alternatives and future consequences.
- Do not write ADRs for routine refactors, naming, file layout, tests, formatting, tooling, or easily reversible implementation details.
- Follow the repository's existing ADR location, numbering, naming, and index conventions. When none exist, store records in `docs/architecture/adr/`, assign the next four-digit number, and maintain a `README.md` index.
- Keep records concise. Do not rewrite an accepted decision; add a superseding ADR when the decision changes.
- Use the Michael Nygard format with a date directly below the title.

## Template

```markdown
# ADR-XXXX: Short Decision Title

- Date: YYYY-MM-DD

## Status

Proposed | Accepted | Rejected | Deprecated | Superseded by ADR-XXXX

## Context

Describe the constraints, forces, and viable alternatives.

## Decision

State the chosen response in active voice: "We will …"

## Consequences

Record positive, negative, and neutral consequences.
```
