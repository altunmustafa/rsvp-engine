---
name: record-adrs
description: Records durable architecture decisions and their tradeoffs. Use when creating or revisiting a decision about public contracts, dependencies, portability, or runtime boundaries.
---

# Record ADRs

## Overview

- Write an ADR only for important, durable decisions with meaningful alternatives and future consequences.
- Routine refactors, naming, tests, formatting, and reversible tooling changes do not need an ADR. Judge by lasting consequences, not the category of file changed.
- Locate the ADR index and relevant records for the affected component in the target repository. Follow its location, numbering, naming, and index conventions. If no convention exists, choose a documentation directory appropriate to the decision's scope, use four-digit numbering, and create an index.
- Preserve accepted decisions as history. When replacing one, add a superseding record and update the old record's status and index links; factual corrections may be edited in place.
- Record unresolved choices as Proposed. Use Accepted only when the decision is established by the user's direction or the repository; writing an ADR does not authorize implementation.
- Follow the repository's existing ADR template. If none exists, use the Michael Nygard template below with a date directly below the title.

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
