import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const LIVE_CONFIRMATION = "gpt-image-2-2k-one-paid-task";
const DEFAULT_BASE_URL = "http://localhost:30080";
const DEFAULT_WAIT_TIMEOUT_MS = 11 * 60 * 1000;
const DEFAULT_MIN_LONG_EDGE = 1800;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

const requestBody = Object.freeze({
  prompt: "A centered red geometric product icon on a calm neutral background, clean studio lighting",
  aspect_ratio: "auto",
  resolution: "2K",
  output_count: 1,
  quality: "auto",
});

export function readLiveConfig(env = process.env) {
  const baseURL = normalizeBaseURL(env.PILIO_BASE_URL ?? DEFAULT_BASE_URL);
  const confirmation = env.PILIO_LIVE_CONFIRM?.trim() ?? "";
  if (confirmation && confirmation !== LIVE_CONFIRMATION) {
    throw new Error(`PILIO_LIVE_CONFIRM must equal ${LIVE_CONFIRMATION}`);
  }

  const execute = confirmation === LIVE_CONFIRMATION;
  const config = {
    execute,
    baseURL,
    apiKey: env.PILIO_API_KEY?.trim() ?? "",
    allowRemote: env.PILIO_LIVE_ALLOW_REMOTE === "1",
    maxCredits: env.PILIO_LIVE_MAX_CREDITS?.trim() ?? "",
    waitTimeoutMs: parseBoundedInteger(env.PILIO_LIVE_WAIT_TIMEOUT_MS, DEFAULT_WAIT_TIMEOUT_MS, 1_000, 30 * 60 * 1000, "PILIO_LIVE_WAIT_TIMEOUT_MS"),
    minLongEdge: parseBoundedInteger(env.PILIO_LIVE_MIN_LONG_EDGE, DEFAULT_MIN_LONG_EDGE, 1, 10_000, "PILIO_LIVE_MIN_LONG_EDGE"),
    cliEntry: env.PILIO_CLI_ENTRY
      ? resolve(env.PILIO_CLI_ENTRY)
      : resolve(import.meta.dirname, "..", "packages", "cli", "dist", "index.js"),
  };

  if (!execute) {
    return config;
  }
  if (!config.apiKey) {
    throw new Error("PILIO_API_KEY is required only after live execution is explicitly confirmed");
  }
  if (!config.maxCredits) {
    throw new Error("PILIO_LIVE_MAX_CREDITS is required for live execution");
  }
  parseCreditUnits(config.maxCredits, "PILIO_LIVE_MAX_CREDITS");
  assertAllowedTarget(config.baseURL, config.allowRemote);
  if (!existsSync(config.cliEntry)) {
    throw new Error(`CLI entry not found: ${config.cliEntry}. Run pnpm build first.`);
  }
  return config;
}

export function assertAllowedTarget(baseURL, allowRemote) {
  const target = new URL(baseURL);
  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!localHosts.has(target.hostname) && !allowRemote) {
    throw new Error("Non-local PILIO_BASE_URL requires PILIO_LIVE_ALLOW_REMOTE=1");
  }
}

export function parseCreditUnits(value, label = "credits") {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) {
    throw new Error(`${label} must be a non-negative decimal with at most two fractional digits`);
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function finalProviderFromResult(result) {
  const context = result?.generator_context;
  if (typeof context?.provider_usage?.provider === "string") {
    return context.provider_usage.provider.trim().toLowerCase();
  }
  const attempts = Array.isArray(context?.route_attempts) ? context.route_attempts : [];
  const succeeded = [...attempts].reverse().find((attempt) => String(attempt?.status).toLowerCase() === "succeeded");
  return typeof succeeded?.provider === "string" ? succeeded.provider.trim().toLowerCase() : "";
}

export function assertAutoWasNotTranslated(result) {
  const context = result?.generator_context;
  const attempts = Array.isArray(context?.route_attempts) ? context.route_attempts : [];
  const notices = [
    ...(Array.isArray(context?.parameter_notices) ? context.parameter_notices : []),
    ...attempts.flatMap((attempt) => (Array.isArray(attempt?.parameter_notices) ? attempt.parameter_notices : [])),
  ];
  const translated = notices.find(
    (notice) => String(notice?.name).toLowerCase() === "aspect_ratio" && String(notice?.disposition).toLowerCase() === "translated",
  );
  if (translated) {
    throw new Error(`aspect_ratio=auto was unexpectedly translated: ${translated.message ?? "no message"}`);
  }
}

export function inspectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) {
    throw new Error("Downloaded result is too small to be a supported image");
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { format: "png", mime: "image/png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    return inspectJPEG(buffer);
  }
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return inspectWebP(buffer);
  }
  throw new Error("Downloaded result magic bytes are not PNG, JPEG, or WebP");
}

export async function runLiveGPTImage2(env = process.env, dependencies = {}) {
  const config = readLiveConfig(env);
  const print = dependencies.print ?? console.log;
  if (!config.execute) {
    print(JSON.stringify({
      mode: "dry-run",
      paid_tasks: 0,
      base_url: config.baseURL,
      cli_ready: existsSync(config.cliEntry),
      request: requestBody,
      required_confirmation: LIVE_CONFIRMATION,
      required_budget_env: "PILIO_LIVE_MAX_CREDITS",
      note: "No network request was made. Start API and Worker yourself before confirmed execution.",
    }, null, 2));
    return { mode: "dry-run" };
  }

  const fetchImpl = dependencies.fetch ?? fetch;
  const runCLI = dependencies.runCLI ?? ((args, timeoutMs) => spawnCLI(config, args, timeoutMs));

  await assertUnsupportedCombinationIsRejected(config, fetchImpl);
  const quote = await fetchQuote(config, fetchImpl, requestBody);
  assertQuoteWithinBudget(quote, config.maxCredits);

  const createdRun = await runCLI([
    "gpt-image-2",
    "--prompt", requestBody.prompt,
    "--aspect-ratio", requestBody.aspect_ratio,
    "--resolution", requestBody.resolution,
    "--output-count", String(requestBody.output_count),
    "--quality", requestBody.quality,
  ], 60_000);
  assertCLIExit(createdRun, "GPT Image 2 create");
  const created = parseJSON(createdRun.stdout, "GPT Image 2 create");
  if (!created.task_id) {
    throw new Error("GPT Image 2 create did not return task_id");
  }

  const waitedRun = await runCLI(["task", "wait", String(created.task_id)], config.waitTimeoutMs);
  assertCLIExit(waitedRun, "GPT Image 2 wait");
  const result = parseJSON(waitedRun.stdout, "GPT Image 2 wait");
  if (result.status !== "Succeeded") {
    throw new Error(`GPT Image 2 ended with status ${result.status ?? "unknown"}`);
  }
  if (!Array.isArray(result.files) || result.files.length !== 1) {
    throw new Error(`GPT Image 2 returned ${Array.isArray(result.files) ? result.files.length : 0} files; expected exactly one`);
  }
  if (finalProviderFromResult(result) !== "kie") {
    throw new Error(`GPT Image 2 2K final provider was ${finalProviderFromResult(result) || "missing"}; expected kie`);
  }
  assertAutoWasNotTranslated(result);

  const image = await downloadAndInspect(result.files[0], fetchImpl, config.minLongEdge);
  const summary = {
    mode: "live",
    paid_tasks: 1,
    task_id: created.task_id,
    quoted_credits: quote.charged_credits,
    max_credits: config.maxCredits,
    provider: "kie",
    requested_aspect_ratio: "auto",
    requested_resolution: "2K",
    image,
  };
  print(JSON.stringify(summary, null, 2));
  return summary;
}

async function assertUnsupportedCombinationIsRejected(config, fetchImpl) {
  const invalid = await postJSON(config, fetchImpl, "/v1/images/gpt-image-2/quote", {
    prompt: "Invalid combination preflight only",
    aspect_ratio: "4:5",
    resolution: "4K",
    output_count: 1,
  });
  if (invalid.response.ok || invalid.envelope?.code === 200 || invalid.envelope?.data?.task_id) {
    throw new Error("Unsupported 4K + 4:5 quote unexpectedly succeeded");
  }
  if (!JSON.stringify(invalid.envelope).toLowerCase().includes("aspect_ratio")) {
    throw new Error("Unsupported combination response did not identify aspect_ratio");
  }
}

async function fetchQuote(config, fetchImpl, body) {
  const quoted = await postJSON(config, fetchImpl, "/v1/images/gpt-image-2/quote", body);
  if (!quoted.response.ok || quoted.envelope?.code !== 200 || !quoted.envelope?.data) {
    throw new Error(`GPT Image 2 quote failed with HTTP ${quoted.response.status}: ${quoted.text.slice(0, 500)}`);
  }
  return quoted.envelope.data;
}

function assertQuoteWithinBudget(quote, maxCredits) {
  const charged = parseCreditUnits(String(quote.charged_credits ?? ""), "quote.charged_credits");
  const cap = parseCreditUnits(maxCredits, "PILIO_LIVE_MAX_CREDITS");
  if (charged > cap) {
    throw new Error(`Quoted cost ${quote.charged_credits} exceeds PILIO_LIVE_MAX_CREDITS=${maxCredits}`);
  }
  if (quote.affordable !== true) {
    throw new Error(`Quote is not affordable: ${quote.blocking_reason ?? "insufficient credits"}`);
  }
  if (quote.estimate_kind !== "final_estimate" || quote.may_change_after_worker_preflight !== false) {
    throw new Error("GPT Image 2 quote is not a final, stable estimate");
  }
}

async function postJSON(config, fetchImpl, path, body) {
  const response = await fetchImpl(`${config.baseURL}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error(`${path} returned non-JSON HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  return { response, envelope, text };
}

async function downloadAndInspect(file, fetchImpl, minLongEdge) {
  if (!file?.download_url) {
    throw new Error("Result file did not include download_url");
  }
  const downloadURL = new URL(file.download_url);
  if (!new Set(["http:", "https:"]).has(downloadURL.protocol)) {
    throw new Error(`Unsupported download URL protocol: ${downloadURL.protocol}`);
  }
  const response = await fetchImpl(downloadURL, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Result download failed with HTTP ${response.status}`);
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Result download exceeds ${MAX_DOWNLOAD_BYTES} bytes`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Result download exceeds ${MAX_DOWNLOAD_BYTES} bytes`);
  }
  const inspected = inspectImage(buffer);
  const responseMime = normalizeImageMime(response.headers.get("content-type"));
  if (responseMime !== inspected.mime) {
    throw new Error(`Content-Type ${responseMime || "missing"} does not match ${inspected.mime} magic bytes`);
  }
  const resultType = normalizeImageType(file.type);
  if (resultType !== inspected.format) {
    throw new Error(`Result file type ${file.type ?? "missing"} does not match ${inspected.format}`);
  }
  const extension = normalizeImageType(extname(file.name ?? "").slice(1));
  if (extension !== inspected.format) {
    throw new Error(`Result filename ${file.name ?? "missing"} does not match ${inspected.format}`);
  }
  if (Math.max(inspected.width, inspected.height) < minLongEdge) {
    throw new Error(`Result ${inspected.width}x${inspected.height} is below the 2K acceptance floor ${minLongEdge}`);
  }
  return {
    format: inspected.format,
    content_type: inspected.mime,
    width: inspected.width,
    height: inspected.height,
    bytes: buffer.length,
  };
}

function spawnCLI(config, args, timeoutMs) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [config.cliEntry, ...args], {
      cwd: resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        PILIO_API_KEY: config.apiKey,
        PILIO_BASE_URL: config.baseURL,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveRun({ status: null, signal: null, stdout, stderr: `${stderr}${error.message}` });
    });
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ status, signal, stdout, stderr });
    });
  });
}

function assertCLIExit(result, label) {
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

function normalizeBaseURL(value) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("PILIO_BASE_URL must be a plain HTTP(S) origin or path without credentials, query, or hash");
  }
  return url.toString().replace(/\/+$/, "");
}

function parseBoundedInteger(raw, fallback, min, max, label) {
  const value = raw === undefined || raw === "" ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function normalizeImageMime(value) {
  const mime = String(value ?? "").split(";", 1)[0].trim().toLowerCase();
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function normalizeImageType(value) {
  const type = String(value ?? "").trim().toLowerCase();
  return type === "jpg" || type === "jpeg" ? "jpeg" : type;
}

function inspectJPEG(buffer) {
  let offset = 2;
  const startOfFrame = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if (startOfFrame.has(marker)) {
      return { format: "jpeg", mime: "image/jpeg", height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += length;
  }
  throw new Error("JPEG dimensions could not be parsed");
}

function inspectWebP(buffer) {
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      format: "webp",
      mime: "image/webp",
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  if (chunk === "VP8L" && buffer.length >= 25) {
    const b1 = buffer[21];
    const b2 = buffer[22];
    const b3 = buffer[23];
    const b4 = buffer[24];
    return {
      format: "webp",
      mime: "image/webp",
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + ((b4 << 6) | ((b3 & 0xfc) >> 2)),
    };
  }
  if (chunk === "VP8 " && buffer.length >= 30 && buffer.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
    return {
      format: "webp",
      mime: "image/webp",
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }
  throw new Error("WebP dimensions could not be parsed");
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  runLiveGPTImage2().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
