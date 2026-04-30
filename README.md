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

