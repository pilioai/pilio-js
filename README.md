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
pilio gpt-image-2.5-flare --prompt "A cinematic product photo" --aspect-ratio 16:9 --resolution 2K
pilio nano-banana-2.1 --prompt "A clean editorial product poster" --aspect-ratio 4:5 --resolution 2K
pilio task wait <task_id>
```

## Try online

Use the hosted Pilio tools to test the same workflows in a browser before automating them:

- [GPT Image 2.5](https://pilio.ai/gpt-image-2-5)
- [Nano Banana 2.1](https://pilio.ai/nano-banana-2-1)
- [Image watermark remover](https://pilio.ai/image-watermark-remover)
- [Background remover](https://pilio.ai/background-remover)
- [Image upscaler](https://pilio.ai/image-upscaler)
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

## Models

- GPT Image 2.5: `client.images.gptImage25Flare` / `gptImage25Sunburst` (`create` and `quote`), CLI `pilio gpt-image-2.5-flare` / `gpt-image-2.5-sunburst`. 1K/2K/4K, one output, up to 16 references.
- Nano Banana 2.1: `client.images.nanoBanana21` (`create` and `quote`), CLI `pilio nano-banana-2.1`. 1K/2K/4K, one output, up to 14 references.
- GPT Image 2 and Nano Banana 2 remain callable for existing integrations but are deprecated.
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

`pnpm live:cli` creates temporary PNG fixtures, runs every CLI command once, waits for each task result, and removes the temporary files. Keep API keys in the process environment only.
