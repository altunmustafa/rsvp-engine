# ADR-0005: Use Platform Unicode Segmentation with Dependency-Free Fallbacks

- Date: 2026-08-19

## Status

Accepted

## Context

Whitespace and UTF-16 code-unit splitting are insufficient for multilingual words, combining marks, and joined emoji. A full Unicode segmentation dependency would violate the core dependency and bundle constraints, while `Intl.Segmenter` is not available in every supported runtime.

## Decision

Feature-detect `Intl.Segmenter` for word and grapheme segmentation. Fall back to whitespace word splitting and a compact combining-mark, variation-selector, and ZWJ-aware grapheme approximation. Continue returning UTF-16 offsets compatible with JavaScript string slicing.

## Consequences

Modern hosts receive platform-quality Unicode segmentation without increasing the bundle. Older hosts remain functional, but their fallback word boundaries and grapheme handling are intentionally less complete than the Unicode standard.
