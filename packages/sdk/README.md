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
  aspect_ratio: "3:2",
});

const result = await client.tasks.wait(task.task_id);
console.log(result);
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

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
