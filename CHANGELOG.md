# Changelog

## 0.3.0 (unreleased)

- Add GPT Image 2.5 Flare and Sunburst create/quote methods to the SDK and typed request/quote exports.
- Add `gpt-image-2.5-flare` and `gpt-image-2.5-sunburst` CLI commands with reference uploads and model-specific option validation.
- Support 1K/2K/4K, one output, auto quality, and up to 16 references. Preserve the exact variant and never fall back to GPT Image 2.
- Synchronize OpenAPI and document account-specific credit quotes and aspect-dependent 4K dimensions.

- Add Nano Banana 2.1 (`images.nanoBanana21.create/quote`) and the `nano-banana-2.1` CLI command with 1K/2K/4K, up to 14 references, and extended aspect ratios.
- GPT Image 2.5 no longer accepts `auto` aspect ratio; the default is `1:1`.
- Deprecate GPT Image 2 and Nano Banana 2 (still callable). Deprecate `pdfs.removeWatermark` and remove the `remove-pdf-watermark` CLI command; the API no longer accepts PDF watermark tasks.
- Remove the `nano-banana-pro` command and SDK method that shipped in 0.2.x; the API never exposed that endpoint.

Publish SDK before CLI; package publication remains a manual release step.
