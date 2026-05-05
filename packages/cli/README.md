# @pilio/cli

Official CLI for Pilio public API tasks.

## Install

```bash
pnpm add -g @pilio/cli
```

You can also run commands without a global install:

```bash
pnpm dlx @pilio/cli <command>
```

## Usage

Create a Pilio API key in your Pilio account, then set it in the environment:

```bash
export PILIO_API_KEY="..."
```

PowerShell:

```powershell
$env:PILIO_API_KEY="..."
```

Run a task:

```bash
pilio gpt-image-2 --prompt "A cinematic product photo" --aspect-ratio 3:2
```

Common commands:

```bash
pilio gpt-image-2 --prompt <text> [--input <path>] [--aspect-ratio <ratio>]
pilio nano-banana-2 --prompt <text> [--input <path>] [--aspect-ratio <ratio>] [--resolution <value>]
pilio remove-image-watermark --input <path>
pilio remove-background --input <path>
pilio upscale-image --input <path>
pilio remove-pdf-watermark --input <path>
pilio task wait <task_id>
```

Most commands return a task payload. Use `pilio task wait <task_id>` to wait for completion and print result files.

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## Try online

Use the hosted tools to test inputs and outputs in a browser before running the same workflow through the CLI:

- `pilio gpt-image-2`: [GPT Image 2](https://pilio.ai/)
- `pilio nano-banana-2`: [Nano Banana 2](https://pilio.ai/nano-banana-2)
- `pilio remove-image-watermark`: [Image watermark remover](https://pilio.ai/image-watermark-remover)
- `pilio remove-background`: [Background remover](https://pilio.ai/background-remover)
- `pilio upscale-image`: [Image upscaler](https://pilio.ai/image-upscaler)
- `pilio remove-pdf-watermark`: [PDF watermark remover](https://pilio.ai/pdf-watermark-remover)
- API reference and examples: [Pilio developers](https://pilio.ai/developers)

## License

MIT
