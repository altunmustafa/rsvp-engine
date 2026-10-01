# ADR-0007: Preserve Speed Inputs in Their Supplied Unit

- Date: 2026-10-02

## Status

Accepted

## Context

The engine accepts WPM and milliseconds per item. Storing only milliseconds loses the original WPM through floating-point round trips: `225` becomes `224.99999999999997`. Rounding the getter would change valid fractional inputs. Storing only WPM would move the same problem to explicit millisecond inputs. Maintaining both numbers would require keeping a redundant pair consistent.

## Decision

We will store the last validated speed input with its unit and derive only the other representation. Constructor `msPerItem` retains precedence over `wpm`. Getters and snapshots preserve the input JavaScript number exactly in its supplied unit. The existing `setSpeed` and `setMsPerItem` methods retain their names and signatures.

## Consequences

No rounding policy or arithmetic dependency is needed, and scheduling continues to use millisecond durations. Speed changes affect subsequent display periods without replacing active timers or paused remainders. Strict reciprocal equality is not guaranteed after setting WPM. Switching to an explicit millisecond input may change the observable WPM even when the interval is unchanged. Snapshots omit the source unit and therefore cannot restore that distinction when both values are passed to the constructor.
