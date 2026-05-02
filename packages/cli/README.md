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

Set your API key in the environment:

```bash
PILIO_API_KEY=... pilio gpt-image-2 generate --prompt "A cinematic product photo" --aspect-ratio 3:2
```

Common commands:

```bash
pilio gpt-image-2 generate --prompt <text> --aspect-ratio <ratio>
pilio gpt-image-2 edit --input <path> --prompt <text>
pilio remove-image-watermark --input <path>
pilio remove-background --input <path>
pilio upscale-image --input <path>
pilio remove-pdf-watermark --input <path>
pilio task wait <task_id>
```

Keep API keys in environment variables or a secure secret store. Do not commit real credentials.

## License

MIT
