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
pilio gpt-image-2 --prompt "A cinematic product photo" --aspect-ratio 3:2
pilio nano-banana-2 --prompt "A clean product poster" --aspect-ratio 1:1 --resolution 1K
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
