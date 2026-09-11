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

const task = await client.images.gptImage2.create({
  prompt: "A cinematic product photo of an orange perfume bottle",
  aspect_ratio: "auto",
  resolution: "2K",
});

const result = await client.tasks.wait(task.task_id);
console.log(result);
```

Nano Banana 2 uses the same async task flow:

```ts
const task = await client.images.nanoBanana2.create({
  prompt: "A clean editorial product poster with precise lighting",
  aspect_ratio: "1:1",
  resolution: "2K",
});
```

## GPT Image 2.5 (unreleased)

These methods are in source and require a newer release than 0.2.2 plus compatible server endpoints.

```ts
const input = { prompt: "A product photograph", resolution: "2K" } as const;
const quote = await client.images.gptImage25Flare.quote(input);
const task = await client.images.gptImage25Flare.create(input);
const result = await client.tasks.wait(task.task_id);
// Sunburst uses client.images.gptImage25Sunburst.create/quote.
```

Both variants support 1K/2K/4K, `output_count: 1`, `quality: "auto"`, and up to 16 uploaded `image_file_ids`. Omit references for text-to-image. Aspect ratios: auto, 1:1, 3:2, 2:3, 3:4, 4:3, 16:9, 9:16, 21:9. Defaults are auto aspect ratio, 1K, one output, and auto quality. 4K is approximately 8.3 megapixels, with dimensions depending on aspect ratio. Unsupported endpoints fail without falling back to GPT Image 2. Quote responses use display credits and do not consume credits.

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

Quote GPT Image 2 before creating a paid task:

```ts
const quote = await client.images.gptImage2.quote({
  prompt: "A centered product icon",
  aspect_ratio: "auto",
  resolution: "2K",
  output_count: 1,
});

if (!quote.affordable || Number(quote.charged_credits) > 17) {
  throw new Error("GPT Image 2 request exceeds the local budget");
}
```

`client.files.upload()` performs the presigned PUT and then confirms the upload through `/v1/files/{id}/complete`. The API key is sent only to Pilio endpoints, never to the presigned upload URL.

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
