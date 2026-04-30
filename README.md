# Pilio JS

Official JavaScript and TypeScript developer tooling for Pilio.

- `@pilio/sdk`: typed SDK for Pilio public API
- `@pilio/cli`: CLI built on top of `@pilio/sdk`

The OpenAPI contract is copied from the Pilio product repository into `openapi/pilio-openapi.json`.

```bash
pnpm install
pnpm sync:openapi
pnpm generate:types
pnpm test
pnpm build
```

Live CLI verification against a real Pilio API environment:

```bash
PILIO_API_KEY=... PILIO_BASE_URL=http://localhost:30080 pnpm live:cli
```

`pnpm live:cli` creates temporary PNG/PDF fixtures, runs every CLI command once, waits for each task result, and removes the temporary files. Keep API keys in the process environment only.
