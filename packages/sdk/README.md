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

`client.files.upload()` performs the presigned PUT and then confirms the upload through `/v1/files/{id}/complete`. The API key is sent only to Pilio endpoints, never to the presigned upload URL.

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
