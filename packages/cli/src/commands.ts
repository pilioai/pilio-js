import { basename, extname } from "node:path";
import type { PilioClient } from "@pilio/sdk";

type FileSystem = {
  readFile(path: string): Promise<BodyInit>;
  stat(path: string): Promise<{ size: number }>;
};

export type CommandRunnerOptions = {
  client: PilioClient;
  fs?: FileSystem;
  output?: (message: string) => void;
};

type ParsedArgs = {
  positionals: string[];
  options: Record<string, string | true | string[]>;
};

const HELP = `Usage: pilio <command> [options]

Commands:
  gpt-image-2 --prompt <text> [--input <path>] [--aspect-ratio <ratio>] [--resolution <1K|2K|4K>]
  nano-banana-pro --prompt <text> [--input <path>] [--aspect-ratio <ratio>]
  remove-image-watermark --input <path>
  remove-background --input <path>
  upscale-image --input <path>
  remove-pdf-watermark --input <path>
  task wait <task_id>
`;

const GPT_IMAGE_2_ASPECT_RATIOS = new Set(["1:1", "3:2", "2:3", "3:4", "4:3", "4:5", "5:4", "7:4", "16:9", "9:16", "21:9", "auto"]);
const GPT_IMAGE_2_RESOLUTIONS = new Set(["1K", "2K", "4K"]);
const GPT_IMAGE_2_HIGH_RES_UNSUPPORTED_ASPECT_RATIOS = new Set(["4:5", "5:4", "7:4"]);

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string | true | string[]> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[i + 1];
    const value: string | true = next && !next.startsWith("--") ? next : true;
    if (value !== true) {
      i += 1;
    }

    const existing = options[key];
    if (Array.isArray(existing)) {
      existing.push(String(value));
    } else if (existing !== undefined) {
      options[key] = [String(existing), String(value)];
    } else {
      options[key] = value;
    }
  }

  return { positionals, options };
}

function requireString(options: Record<string, string | true | string[]>, key: string) {
  const value = options[key];
  if (typeof value !== "string") {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function optionalString(options: Record<string, string | true | string[]>, key: string) {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}

function optionalInteger(options: Record<string, string | true | string[]>, key: string) {
  const value = optionalString(options, key);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Option --${key} must be an integer`);
  }
  return parsed;
}

function stringList(options: Record<string, string | true | string[]>, key: string) {
  const value = options[key];
  if (Array.isArray(value)) {
    return value;
  }
  return typeof value === "string" ? [value] : [];
}

function extensionType(path: string) {
  return extname(path).replace(/^\./, "").toLowerCase();
}

function printJSON(output: (message: string) => void, value: unknown) {
  output(JSON.stringify(value, null, 2));
}

function validateGPTImage2Options(options: Record<string, string | true | string[]>) {
  const aspectRatio = optionalString(options, "aspect-ratio");
  const resolution = optionalString(options, "resolution");

  if (aspectRatio && !GPT_IMAGE_2_ASPECT_RATIOS.has(aspectRatio)) {
    throw new Error(`Option --aspect-ratio must be one of: ${[...GPT_IMAGE_2_ASPECT_RATIOS].join(", ")}`);
  }
  if (resolution && !GPT_IMAGE_2_RESOLUTIONS.has(resolution)) {
    throw new Error(`Option --resolution must be one of: ${[...GPT_IMAGE_2_RESOLUTIONS].join(", ")}`);
  }
  if (
    resolution &&
    resolution !== "1K" &&
    aspectRatio &&
    GPT_IMAGE_2_HIGH_RES_UNSUPPORTED_ASPECT_RATIOS.has(aspectRatio)
  ) {
    throw new Error(`GPT Image 2 ${resolution} does not support aspect ratio ${aspectRatio}`);
  }
}

export function createCommandRunner(options: CommandRunnerOptions) {
  const output = options.output ?? console.log;

  return async function run(args: string[]) {
    const parsed = parseArgs(args);
    const [command, subcommand, maybeTaskId] = parsed.positionals;

    if (!command || command === "help" || command === "--help") {
      output(HELP);
      return;
    }

    if (command === "gpt-image-2") {
      if (subcommand) {
        throw new Error(
          "Use unified syntax: pilio gpt-image-2 --prompt <text> [--input <path>] [--aspect-ratio <ratio>] [--resolution <1K|2K|4K>]",
        );
      }
      validateGPTImage2Options(parsed.options);
      await createImageTask(options, parsed.options, (payload) => options.client.images.gptImage2.create(payload));
      return;
    }

    if (command === "nano-banana-pro") {
      if (subcommand) {
        throw new Error("Use unified syntax: pilio nano-banana-pro --prompt <text> [--input <path>]");
      }
      await createImageTask(options, parsed.options, (payload) => options.client.images.nanoBananaPro.create(payload));
      return;
    }

    if (command === "remove-image-watermark") {
      const file = await uploadInput(options, requireString(parsed.options, "input"));
      const result = await options.client.images.removeWatermark({ image_file_id: String(file.id) });
      printJSON(output, result);
      return;
    }

    if (command === "remove-background") {
      const file = await uploadInput(options, requireString(parsed.options, "input"));
      const result = await options.client.images.removeBackground({ image_file_id: String(file.id) });
      printJSON(output, result);
      return;
    }

    if (command === "upscale-image") {
      const file = await uploadInput(options, requireString(parsed.options, "input"));
      const result = await options.client.images.upscale({ image_file_id: String(file.id) });
      printJSON(output, result);
      return;
    }

    if (command === "remove-pdf-watermark") {
      const file = await uploadInput(options, requireString(parsed.options, "input"));
      const result = await options.client.pdfs.removeWatermark({
        pdf_file_id: String(file.id),
        ...(optionalString(parsed.options, "mode") ? { mode: optionalString(parsed.options, "mode") as never } : {}),
      });
      printJSON(output, result);
      return;
    }

    if (command === "task" && subcommand === "wait") {
      if (!maybeTaskId) {
        throw new Error("Missing task id");
      }
      const result = await options.client.tasks.wait(maybeTaskId);
      printJSON(output, result);
      return;
    }

    output(HELP);
    throw new Error(`Unknown command: ${command}`);
  };
}

async function uploadInput(options: CommandRunnerOptions, inputPath: string) {
  const fs = options.fs ?? (await import("node:fs/promises"));
  const [data, stat] = await Promise.all([fs.readFile(inputPath), fs.stat(inputPath)]);
  return options.client.files.upload({
    name: basename(inputPath),
    type: extensionType(inputPath),
    data,
    size: stat.size,
  });
}

async function createImageTask(
  options: CommandRunnerOptions,
  parsedOptions: Record<string, string | true | string[]>,
  createTask: (payload: never) => Promise<unknown>,
) {
  const inputPaths = stringList(parsedOptions, "input");
  const files = await Promise.all(inputPaths.map((inputPath) => uploadInput(options, inputPath)));
  const payload = {
    prompt: requireString(parsedOptions, "prompt"),
    ...(files.length > 0 ? { image_file_ids: files.map((file) => file.id).filter(Boolean) as string[] } : {}),
    ...(optionalString(parsedOptions, "aspect-ratio") ? { aspect_ratio: optionalString(parsedOptions, "aspect-ratio") as never } : {}),
    ...(optionalString(parsedOptions, "quality") ? { quality: optionalString(parsedOptions, "quality") as never } : {}),
    ...(optionalString(parsedOptions, "resolution") ? { resolution: optionalString(parsedOptions, "resolution") as never } : {}),
    ...(optionalInteger(parsedOptions, "output-count") !== undefined ? { output_count: optionalInteger(parsedOptions, "output-count") } : {}),
  };
  const result = await createTask(payload as never);
  const output = options.output ?? console.log;
  printJSON(output, result);
}
