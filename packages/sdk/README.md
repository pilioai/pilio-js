# @pilio/sdk

Official JavaScript and TypeScript SDK for the Pilio public API.

## Install

```bash
pnpm add @pilio/sdk
```

## Usage

```ts
import { PilioClient } from "@pilio/sdk";

const client = new PilioClient({
  apiKey: process.env.PILIO_API_KEY!,
});

const task = await client.images.gptImage2.generate({
  prompt: "A cinematic product photo of an orange perfume bottle",
  aspect_ratio: "3:2",
});

const result = await client.tasks.wait(task.task_id);
console.log(result);
```

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
