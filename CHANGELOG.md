# Changelog

## 0.3.0 (unreleased)

- Add GPT Image 2.5 Flare and Sunburst create/quote methods to the SDK and typed request/quote exports.
- Add `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` CLI commands with reference uploads and model-specific option validation.
- Support 1K/2K/4K, one output, auto quality, and up to 16 references. Preserve the exact variant and never fall back to GPT Image 2.
- Synchronize OpenAPI and document account-specific credit quotes and aspect-dependent 4K dimensions.

Requires the corresponding server endpoints to be deployed. Existing GPT Image 2 and other commands remain compatible. Version 0.2.2 does not contain Image 2.5 support. Publish SDK before CLI after server rollout; package publication remains a manual release step.
