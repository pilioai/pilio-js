# Pilio JS

Official JavaScript and TypeScript developer tooling for Pilio.

- `@pilio/sdk`: typed SDK for Pilio public API
- `@pilio/cli`: CLI built on top of `@pilio/sdk`

The OpenAPI contract is copied from the Pilio product repository into `openapi/pilio-openapi.json`.

## Install

```bash
pnpm add @pilio/sdk
pnpm add -g @pilio/cli
```

You can also run the CLI without installing it globally:

```bash
pnpm dlx @pilio/cli --help
```

## API key

Create a Pilio API key in your Pilio account, then expose it through the local process environment:

```bash
export PILIO_API_KEY="..."
```

PowerShell:

```powershell
$env:PILIO_API_KEY="..."
```

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## CLI example

```bash
pilio gpt-image-2 --prompt "A cinematic product photo" --aspect-ratio auto --resolution 2K
pilio nano-banana-2 --prompt "A clean editorial product poster" --resolution 2K
pilio task wait <task_id>
```

## Try online

Use the hosted Pilio tools to test the same workflows in a browser before automating them:

- [GPT Image 2](https://pilio.ai/)
- [Nano Banana 2](https://pilio.ai/nano-banana-2)
- [Image watermark remover](https://pilio.ai/image-watermark-remover)
- [Background remover](https://pilio.ai/background-remover)
- [Image upscaler](https://pilio.ai/image-upscaler)
- [PDF watermark remover](https://pilio.ai/pdf-watermark-remover)
- [Developer documentation](https://pilio.ai/developers)

## SDK upload example

```ts
import { readFile } from "node:fs/promises";
import { PilioClient } from "@pilio/sdk";

const client = new PilioClient({
  apiKey: process.env.PILIO_API_KEY!,
});

const image = await readFile("portrait.png");
const file = await client.files.upload({
  name: "portrait.png",
  type: "png",
  data: new Blob([image]),
  size: image.byteLength,
});

const task = await client.images.removeBackground({
  image_file_id: file.id!,
});

const result = await client.tasks.wait(task.task_id);
console.log(result.files);
```

## GPT Image 2.5 (unreleased)

Source support is available for Flare and Sunburst. Published version 0.2.2 does not include it. Both the server endpoints and a newer SDK/CLI release are required.

- SDK: `client.images.gptImage25Flare.create/quote` and `client.images.gptImage25Sunburst.create/quote`.
- CLI: `pilio gpt-image-2.5-flare` and `pilio gpt-image-2.5-sunburst`.
- Both variants support 1K/2K/4K, one output, auto quality, and up to 16 reference images. They never fall back to GPT Image 2.
- Use `quote` for current account pricing. 4K dimensions depend on aspect ratio; 16:9 is approximately 3840x2160, not 4096x4096.

## Development

```bash
pnpm install
pnpm sync:openapi
pnpm generate:types
pnpm test
pnpm build
```

Live CLI verification against a real Pilio API environment:

```bash
PILIO_API_KEY=... PILIO_BASE_URL=https://pilio.ai pnpm live:cli
```

`pnpm live:cli` creates temporary PNG/PDF fixtures, runs every CLI command once, waits for each task result, and removes the temporary files. Keep API keys in the process environment only.

Focused GPT Image 2 2K verification is dry-run by default and quotes the request before allowing one paid task:

```powershell
pnpm run live:gpt-image-2
$env:PILIO_BASE_URL="http://localhost:30080"
$env:PILIO_API_KEY="..."
$env:PILIO_LIVE_MAX_CREDITS="17"
$env:PILIO_LIVE_CONFIRM="gpt-image-2-2k-one-paid-task"
pnpm run live:gpt-image-2
```

The focused check validates an unsupported combination through the no-charge quote endpoint, enforces the quoted credit cap, creates exactly one `auto + 2K` task, requires the final provider to be KIE, and verifies the downloaded image's content type, magic bytes, extension, and dimensions. It does not start local services. Non-local targets additionally require `PILIO_LIVE_ALLOW_REMOTE=1`.
