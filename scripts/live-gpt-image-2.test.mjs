import test from "node:test";
import assert from "node:assert/strict";
import {
  LIVE_CONFIRMATION,
  assertAllowedTarget,
  assertAutoWasNotTranslated,
  finalProviderFromResult,
  inspectImage,
  parseCreditUnits,
  readLiveConfig,
  runLiveGPTImage2,
} from "./live-gpt-image-2.mjs";

test("dry-run requires no API key and makes no network request", async () => {
  let fetchCalls = 0;
  const messages = [];
  const result = await runLiveGPTImage2({}, {
    fetch: async () => { fetchCalls += 1; throw new Error("unexpected fetch"); },
    print: (message) => messages.push(message),
  });

  assert.deepEqual(result, { mode: "dry-run" });
  assert.equal(fetchCalls, 0);
  assert.match(messages[0], /"paid_tasks": 0/);
});

test("live execution requires an explicit budget and API key", () => {
  assert.throws(() => readLiveConfig({ PILIO_LIVE_CONFIRM: LIVE_CONFIRMATION }), /PILIO_API_KEY/);
  assert.throws(
    () => readLiveConfig({ PILIO_LIVE_CONFIRM: LIVE_CONFIRMATION, PILIO_API_KEY: "secret" }),
    /PILIO_LIVE_MAX_CREDITS/,
  );
});

test("remote targets need a second opt-in", () => {
  assert.doesNotThrow(() => assertAllowedTarget("http://localhost:30080", false));
  assert.throws(() => assertAllowedTarget("https://pilio.ai", false), /PILIO_LIVE_ALLOW_REMOTE=1/);
  assert.doesNotThrow(() => assertAllowedTarget("https://pilio.ai", true));
});

test("credit comparison uses exact scale=100 units", () => {
  assert.equal(parseCreditUnits("16.68"), 1668n);
  assert.equal(parseCreditUnits("17"), 1700n);
  assert.throws(() => parseCreditUnits("1.234"), /at most two fractional digits/);
});

test("provider and auto translation checks use generator context", () => {
  const result = {
    generator_context: {
      provider_usage: { provider: "KIE" },
      route_attempts: [{ provider: "kie", status: "succeeded", parameter_notices: [] }],
    },
  };
  assert.equal(finalProviderFromResult(result), "kie");
  assert.doesNotThrow(() => assertAutoWasNotTranslated(result));
  assert.throws(
    () => assertAutoWasNotTranslated({
      generator_context: {
        parameter_notices: [{ name: "aspect_ratio", disposition: "translated", message: "changed to 3:2" }],
      },
    }),
    /unexpectedly translated/,
  );
});

test("PNG magic bytes expose exact dimensions", () => {
  const png = mockPNG(2048, 1536);
  assert.deepEqual(inspectImage(png), { format: "png", mime: "image/png", width: 2048, height: 1536 });
});

test("an over-budget quote aborts before the paid CLI command", async () => {
  const responses = [
    jsonResponse(400, { code: 1400, message: "aspect_ratio is unsupported", data: null }),
    jsonResponse(200, {
      code: 200,
      message: "ok",
      data: {
        charged_credits: "17.01",
        affordable: true,
        estimate_kind: "final_estimate",
        may_change_after_worker_preflight: false,
      },
    }),
  ];
  let cliCalls = 0;

  await assert.rejects(
    () => runLiveGPTImage2(liveEnv(), {
      fetch: async () => responses.shift(),
      runCLI: async () => { cliCalls += 1; throw new Error("unexpected CLI call"); },
      print: () => {},
    }),
    /exceeds PILIO_LIVE_MAX_CREDITS/,
  );
  assert.equal(cliCalls, 0);
});

test("mock live flow creates exactly one auto + 2K task after a safe quote", async () => {
  const png = mockPNG(2048, 2048);
  const responses = [
    jsonResponse(400, { code: 1400, message: "aspect_ratio is unsupported", data: null }),
    jsonResponse(200, {
      code: 200,
      message: "ok",
      data: {
        charged_credits: "16.68",
        affordable: true,
        estimate_kind: "final_estimate",
        may_change_after_worker_preflight: false,
      },
    }),
    binaryResponse(png, "image/png"),
  ];
  const cliArgs = [];
  const runCLI = async (args) => {
    cliArgs.push(args);
    if (args[0] === "gpt-image-2") {
      return { status: 0, signal: null, stdout: JSON.stringify({ task_id: "task_2k" }), stderr: "" };
    }
    return {
      status: 0,
      signal: null,
      stdout: JSON.stringify({
        task_id: "task_2k",
        status: "Succeeded",
        files: [{ name: "result.png", type: "png", download_url: "https://download.test/result.png" }],
        generator_context: {
          provider_usage: { provider: "kie" },
          route_attempts: [{ provider: "kie", status: "succeeded", parameter_notices: [] }],
        },
      }),
      stderr: "",
    };
  };

  const result = await runLiveGPTImage2(liveEnv(), {
    fetch: async () => responses.shift(),
    runCLI,
    print: () => {},
  });

  assert.equal(result.paid_tasks, 1);
  assert.equal(result.provider, "kie");
  assert.equal(cliArgs.length, 2);
  assert.deepEqual(cliArgs[0].slice(0, 7), [
    "gpt-image-2",
    "--prompt",
    "A centered red geometric product icon on a calm neutral background, clean studio lighting",
    "--aspect-ratio",
    "auto",
    "--resolution",
    "2K",
  ]);
});

function liveEnv() {
  return {
    PILIO_BASE_URL: "http://localhost:30080",
    PILIO_API_KEY: "test-key",
    PILIO_LIVE_MAX_CREDITS: "17",
    PILIO_LIVE_CONFIRM: LIVE_CONFIRMATION,
  };
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(payload),
  };
}

function binaryResponse(buffer, contentType) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": contentType, "content-length": String(buffer.length) }),
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  };
}

function mockPNG(width, height) {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  return png;
}
