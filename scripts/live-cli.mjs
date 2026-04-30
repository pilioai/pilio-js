import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const repoRoot = resolve(import.meta.dirname, "..");
const cliEntry = process.env.PILIO_CLI_ENTRY
  ? resolve(process.env.PILIO_CLI_ENTRY)
  : resolve(repoRoot, "packages", "cli", "dist", "index.js");
const baseURL = process.env.PILIO_BASE_URL;
const apiKey = process.env.PILIO_API_KEY;
const waitTimeoutMs = Number(process.env.PILIO_LIVE_WAIT_TIMEOUT_MS ?? 11 * 60 * 1000);
const tmpDir = resolve(repoRoot, ".tmp", `live-cli-${Date.now()}`);

if (!apiKey) {
  throw new Error("PILIO_API_KEY is required for live CLI testing");
}
if (!baseURL) {
  throw new Error("PILIO_BASE_URL is required for live CLI testing");
}
if (!existsSync(cliEntry)) {
  throw new Error(`CLI entry not found: ${cliEntry}. Run pnpm build first.`);
}

const files = {
  source: join(tmpDir, "source.png"),
  watermark: join(tmpDir, "watermark.png"),
  reference: join(tmpDir, "reference.png"),
  pdf: join(tmpDir, "watermark.pdf"),
};

try {
  await createFixtures();

  const commands = [
    {
      name: "gpt-image-2 generate",
      args: ["gpt-image-2", "generate", "--prompt", "A tiny red square icon on white background", "--aspect-ratio", "1:1"],
    },
    {
      name: "gpt-image-2 edit",
      args: ["gpt-image-2", "edit", "--input", files.reference, "--prompt", "Make the image cleaner"],
    },
    {
      name: "remove-image-watermark",
      args: ["remove-image-watermark", "--input", files.watermark],
    },
    {
      name: "remove-background",
      args: ["remove-background", "--input", files.source],
    },
    {
      name: "upscale-image",
      args: ["upscale-image", "--input", files.source],
    },
    {
      name: "remove-pdf-watermark",
      args: ["remove-pdf-watermark", "--input", files.pdf, "--mode", "editable"],
    },
  ];

  const created = [];
  for (const command of commands) {
    const result = await runCLI(command.args, waitTimeoutMs);
    assertExit(result, command.name);
    const payload = parseJSON(result.stdout, command.name);
    if (!payload.task_id) {
      throw new Error(`${command.name} did not return task_id`);
    }
    created.push({ name: command.name, taskId: payload.task_id });
    console.log(`${command.name}: created ${payload.task_id}`);
  }

  const waited = await Promise.all(
    created.map(async (task) => {
      const result = await runCLI(["task", "wait", task.taskId], waitTimeoutMs);
      assertExit(result, `${task.name} wait`);
      const payload = parseJSON(result.stdout, `${task.name} wait`);
      return {
        name: task.name,
        task_id: task.taskId,
        status: payload.status,
        file_count: Array.isArray(payload.files) ? payload.files.length : 0,
      };
    }),
  );

  for (const result of waited) {
    if (result.status !== "Succeeded") {
      throw new Error(`${result.name} ended with status ${result.status}`);
    }
    if (result.file_count < 1) {
      throw new Error(`${result.name} did not return result files`);
    }
  }

  console.log(JSON.stringify(waited, null, 2));
  console.log("Live CLI test passed for all commands");
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}

async function createFixtures() {
  await mkdir(tmpDir, { recursive: true });
  await writeFile(files.source, createPNG(512, 512, [74, 144, 226, 255], "source"));
  await writeFile(files.watermark, createPNG(512, 512, [76, 175, 80, 255], "watermark"));
  await writeFile(files.reference, createPNG(512, 512, [239, 83, 80, 255], "reference"));
  await writeFile(files.pdf, createPDF());
}

function runCLI(args, timeoutMs) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [cliEntry, ...args], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PILIO_API_KEY: apiKey,
        PILIO_BASE_URL: baseURL,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

function assertExit(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status ?? result.signal}\n${result.stderr || result.stdout}`);
  }
}

function parseJSON(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} did not return JSON\n${text}\n${error instanceof Error ? error.message : String(error)}`);
  }
}

function createPNG(width, height, background, variant) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      const inBox = x > 88 && x < 424 && y > 88 && y < 424;
      const diagonal = Math.abs(x - y) < 10 || Math.abs(x + y - width) < 10;
      const stripe = variant === "watermark" && (x + y) % 86 < 18;
      const circle = (x - 256) ** 2 + (y - 256) ** 2 < 118 ** 2;
      const color = stripe
        ? [30, 30, 30, 210]
        : diagonal
          ? [255, 255, 255, 230]
          : circle
            ? [255, 235, 59, 255]
            : inBox
              ? [255, 255, 255, 255]
              : background;
      raw[offset] = color[0];
      raw[offset + 1] = color[1];
      raw[offset + 2] = color[2];
      raw[offset + 3] = color[3];
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", Buffer.concat([uint32(width), uint32(height), Buffer.from([8, 6, 0, 0, 0])])),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const checksum = crc32(Buffer.concat([typeBuffer, data]));
  return Buffer.concat([uint32(data.length), typeBuffer, data, uint32(checksum)]);
}

function uint32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPDF() {
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    "4 0 obj << /Length 93 >> stream\nBT /F1 36 Tf 100 700 Td (Pilio PDF test) Tj /F1 28 Tf 140 420 Td (WATERMARK SAMPLE) Tj ET\nendstream endobj\n",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  const offsets = [0];
  let offset = parts[0].length;
  for (let i = 1; i < parts.length; i += 1) {
    offsets.push(offset);
    offset += parts[i].length;
  }
  const xrefOffset = offset;
  const xref = [
    "xref\n",
    "0 6\n",
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((item) => `${String(item).padStart(10, "0")} 00000 n \n`),
    "trailer << /Size 6 /Root 1 0 R >>\n",
    "startxref\n",
    `${xrefOffset}\n`,
    "%%EOF\n",
  ];
  return Buffer.from([...parts, ...xref].join(""), "ascii");
}
