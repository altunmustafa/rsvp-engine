# ADR-0015: Keep position outside presentation items

- Date: 2026-10-16

## Status

Accepted

## Context

`RsvpItem.index` duplicates the position already available on the engine and snapshot. Keeping it on the item couples presentation content to sequence position and obscures the distinction between source tokens and the presentation overrides established in [ADR-0012](./0012-persistent-ovp-preferences.md).

## Decision

We will expose sequence position through `currentIndex` and remove it from `RsvpItem`. `Token` names source data with initial offsets; `RsvpItem` names the effective presentation of that data. Both roles use the same readonly shape, expressed through a type alias rather than duplicated fields or nominal branding. The engine retains source token copies and derives presentation without modifying their offsets.

## Consequences

Consumers must read position separately from item content. Core and React share this breaking contract change. The role names remain useful in signatures and variables, but TypeScript does not enforce a nominal distinction between them. Unchanged presentations can reuse the source token reference.
