# @pilio/sdk

Official JavaScript and TypeScript SDK for the Pilio public API.

## Install

```bash
pnpm add @pilio/sdk
```

## Usage

Create a Pilio API key in your Pilio account and expose it as `PILIO_API_KEY`.

```ts
import { PilioClient } from "@pilio/sdk";

const client = new PilioClient({
  apiKey: process.env.PILIO_API_KEY!,
});

const input = { prompt: "A cinematic product photo of an orange perfume bottle", aspect_ratio: "16:9", resolution: "2K" } as const;
const quote = await client.images.gptImage25Flare.quote(input);
const task = await client.images.gptImage25Flare.create(input);
const result = await client.tasks.wait(task.task_id);
console.log(quote, result);
// Sunburst uses client.images.gptImage25Sunburst.create/quote.
```

GPT Image 2.5 Flare and Sunburst support 1K/2K/4K, `output_count: 1`, `quality: "auto"`, and up to 16 uploaded `image_file_ids`. Omit references for text-to-image. Aspect ratios: 1:1, 3:2, 2:3, 3:4, 4:3, 16:9, 9:16, 21:9 (default 1:1; `auto` is not supported). 4K is approximately 8.3 megapixels, with dimensions depending on aspect ratio. Quote responses use display credits and do not consume credits.

Nano Banana 2.1 uses the same async task flow:

```ts
const task = await client.images.nanoBanana21.create({
  prompt: "A clean editorial product poster with precise lighting",
  aspect_ratio: "4:5",
  resolution: "2K",
});
```

It supports 1K/2K/4K, one output, and up to 14 `image_file_ids`; `aspect_ratio` is required for text-to-image. Use `client.images.nanoBanana21.quote` to check credits first.

`images.gptImage2`, `images.nanoBanana2`, and `pdfs.removeWatermark` are deprecated. The first two still work for existing integrations; PDF watermark removal no longer accepts new tasks.

## Upload a local file

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

Quote before creating a paid task:

```ts
const quote = await client.images.gptImage25Flare.quote({
  prompt: "A centered product icon",
  aspect_ratio: "1:1",
  resolution: "2K",
});

if (!quote.affordable || Number(quote.charged_credits) > 20) {
  throw new Error("Request exceeds the local budget");
}
```

`client.files.upload()` performs the presigned PUT and then confirms the upload through `/v1/files/{id}/complete`. The API key is sent only to Pilio endpoints, never to the presigned upload URL.

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
