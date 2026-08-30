# Product Theta.7 — Provider Identity Relevance

Theta.7 hardens provider discovery using evidence from the second real Railway acquisition run.

## Production finding

After Theta.6 fixed substring matching, the Finnish VAT demand still admitted `Hetzner Cloud API` because its description mentioned VAT in pricing text. A single descriptive mention is not strong enough evidence that a provider actually offers the requested capability.

## Relevance gate

For each structured directory entry, demand terms are matched as complete tokens.

A provider is now admissible only when at least one of these conditions is true:

1. at least one demand term appears in provider identity (`directory_id` or API title); or
2. at least two distinct demand terms appear in the provider description.

This keeps explicit providers such as `VAT API`, while filtering incidental descriptive mentions such as cloud pricing that happens to mention VAT.

## Trust boundary

Theta.7 changes discovery ranking only. It does not weaken OpenAPI compilation, evidence-backed verification-input harvesting, live replay verification, or durable promotion.

Providers that survive discovery still must pass all later Theta gates.
