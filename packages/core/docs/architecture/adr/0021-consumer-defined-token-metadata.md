# ADR-0021: Preserve consumer-defined token metadata

- Date: 2026-10-21

## Status

Accepted

## Context

Applications need to associate presented items with their original content, including repeated words and Unicode text. Dedicated source-span fields would make Core responsible for a text-mapping convention while excluding other useful application data. Unconditionally optional metadata would also prevent applications from trusting a concrete metadata type. The source-token and presentation roles established in [ADR-0015](./0015-position-independent-presentation-items.md) already share a readonly shape.

## Decision

We will carry consumer-defined metadata on tokens and presented items. Each engine has one fixed metadata type, inferred from a supplied tokenizer or specified explicitly, with an unknown default. Metadata is optional exactly when its type accepts undefined; otherwise every token must carry it. Core and React preserve that type and the supplied data without interpreting or validating its contents.

The same presence rule applies to tokenizer output and prepared tokens. A tokenizer is optional independently of metadata presence, as established in [ADR-0022](./0022-explicit-content-loading.md). Built-in tokenization remains metadata-free; applications own source mapping and sentence navigation.

Metadata remains application-owned and travels by reference, like generic item values. Core freezes token copies and snapshots without cloning or deeply freezing their contents. See the [API reference](../../API-REFERENCE.md#application-metadata) for the public contract.

## Consequences

Consumers can retain source spans or other data across presentation changes without coupling the engine to a document format. Applications choosing required metadata can read it directly after checking that an item exists; empty sessions still have no current item. Conditional public types add declaration complexity. Applications must keep referenced metadata immutable while in use because mutations are not observed. No runtime metadata schema, additional dependency, or adapter-owned mapping store is needed.
