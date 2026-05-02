import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const cliEntry = process.env.PILIO_CLI_ENTRY
  ? resolve(process.env.PILIO_CLI_ENTRY)
  : resolve(repoRoot, "packages", "cli", "dist", "index.js");
const tmpDir = await mkdtemp(join(tmpdir(), "pilio-cli-smoke-"));

const files = {
  portrait: join(tmpDir, "portrait.png"),
  watermarked: join(tmpDir, "watermarked.png"),
  small: join(tmpDir, "small.png"),
  pdf: join(tmpDir, "watermarked.pdf"),
  refA: join(tmpDir, "reference-a.png"),
  refB: join(tmpDir, "reference-b.png"),
};

for (const [index, filePath] of Object.values(files).entries()) {
  await writeFile(filePath, new Uint8Array([index + 1, 80, 73, 76, 73, 79]));
}

const observed = {
  fileCreates: [],
  uploads: [],
  taskCreates: [],
  taskStatuses: [],
  taskResults: [],
};

let fileCounter = 0;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const body = await readRequestBody(req);

    if (req.method === "POST" && url.pathname === "/v1/files/batch-create") {
      const payload = JSON.parse(body.toString("utf8"));
      const source = payload.files?.[0] ?? {};
      fileCounter += 1;
      const id = `file_${fileCounter}`;
      observed.fileCreates.push({ auth: req.headers.authorization ?? "", payload, id });
      json(res, {
        code: 200,
        message: "ok",
        data: {
          total: 1,
          items: [
            {
              id,
              name: source.name,
              type: source.type,
              upload_url: `${currentBaseURL()}/upload/${id}`,
            },
          ],
        },
      });
      return;
    }

    if (req.method === "PUT" && url.pathname.startsWith("/upload/")) {
      observed.uploads.push({
        auth: req.headers.authorization ?? "",
        path: url.pathname,
        bytes: body.length,
      });
      res.statusCode = body.length > 0 ? 200 : 400;
      res.end();
      return;
    }

    const createTask = taskCreateRoutes[url.pathname];
    if (req.method === "POST" && createTask) {
      const payload = JSON.parse(body.toString("utf8"));
      observed.taskCreates.push({
        auth: req.headers.authorization ?? "",
        path: url.pathname,
        payload,
      });
      json(res, {
        code: 200,
        message: "ok",
        data: {
          task_id: createTask.taskId,
          status: "Pending",
          status_url: `/v1/tasks/${createTask.taskId}/status`,
          result_url: `/v1/tasks/${createTask.taskId}/result`,
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/tasks/task_wait/status") {
      observed.taskStatuses.push({ auth: req.headers.authorization ?? "" });
      json(res, {
        code: 200,
        message: "ok",
        data: {
          task_id: "task_wait",
          status: "Succeeded",
          result_url: "/v1/tasks/task_wait/result",
        },
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/v1/tasks/task_wait/result") {
      observed.taskResults.push({ auth: req.headers.authorization ?? "" });
      json(res, {
        code: 200,
        message: "ok",
        data: {
          task_id: "task_wait",
          status: "Succeeded",
          files: [{ id: "result_1", download_url: "https://download.example/result.png" }],
        },
      });
      return;
    }

    res.statusCode = 404;
    res.end(`unexpected ${req.method} ${url.pathname}`);
  } catch (error) {
    res.statusCode = 500;
    res.end(error instanceof Error ? error.stack : String(error));
  }
});

const taskCreateRoutes = {
  "/v1/images/gpt-image-2": { taskId: "task_gpt_image_2" },
  "/v1/images/nano-banana-2": { taskId: "task_nano_banana_2" },
  "/v1/images/remove-watermark": { taskId: "task_remove_image_watermark" },
  "/v1/images/remove-background": { taskId: "task_remove_background" },
  "/v1/images/upscale": { taskId: "task_upscale_image" },
  "/v1/pdfs/remove-watermark": { taskId: "task_remove_pdf_watermark" },
};

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const baseURL = currentBaseURL();

try {
  await expectCLI(["gpt-image-2", "--prompt", "hello", "--aspect-ratio", "1:1"], "task_gpt_image_2");
  await expectCLI(["gpt-image-2", "--input", files.refA, "--input", files.refB, "--prompt", "make it crisp"], "task_gpt_image_2");
  await expectCLI(["nano-banana-2", "--prompt", "hello banana", "--aspect-ratio", "1:1", "--resolution", "1K"], "task_nano_banana_2");
  await expectCLI(["remove-image-watermark", "--input", files.watermarked], "task_remove_image_watermark");
  await expectCLI(["remove-background", "--input", files.portrait], "task_remove_background");
  await expectCLI(["upscale-image", "--input", files.small], "task_upscale_image");
  await expectCLI(["remove-pdf-watermark", "--input", files.pdf, "--mode", "ai"], "task_remove_pdf_watermark");
  await expectCLI(["task", "wait", "task_wait"], "result_1");

  assertAllPilioRequestsAreAuthenticated();
  assertAllUploadsOmitAPIKey();
  assertTaskBody("/v1/images/gpt-image-2", (body) => {
    assert(body.prompt === "hello", "generation prompt mismatch");
    assert(body.aspect_ratio === "1:1", "generation aspect ratio mismatch");
  });
  assertTaskBody("/v1/images/gpt-image-2", (body) => {
    assert(Array.isArray(body.image_file_ids), "edit image_file_ids missing");
    assert(body.image_file_ids.length === 2, "edit should upload two reference images");
    assert(body.prompt === "make it crisp", "edit prompt mismatch");
  });
  assertTaskBody("/v1/images/nano-banana-2", (body) => {
    assert(body.prompt === "hello banana", "Nano Banana 2 prompt mismatch");
    assert(body.resolution === "1K", "Nano Banana 2 resolution mismatch");
  });
  assertTaskBody("/v1/images/remove-watermark", (body) => assertHasFileID(body, "remove image watermark"));
  assertTaskBody("/v1/images/remove-background", (body) => assertHasFileID(body, "remove background"));
  assertTaskBody("/v1/images/upscale", (body) => assertHasFileID(body, "upscale image"));
  assertTaskBody("/v1/pdfs/remove-watermark", (body) => {
    assert(typeof body.pdf_file_id === "string" && body.pdf_file_id.startsWith("file_"), "PDF watermark command did not use uploaded PDF file id");
    assert(body.mode === "ai", "PDF watermark mode mismatch");
  });
  assert(observed.taskStatuses.length === 1, "task wait should query task status");
  assert(observed.taskResults.length === 1, "task wait should query task result after success");

  console.log("CLI smoke passed for all commands");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(tmpDir, { recursive: true, force: true });
}

async function expectCLI(args, expectedOutput) {
  const result = await runCLI(args, {
    PILIO_API_KEY: "pilio_sk_test",
    PILIO_BASE_URL: baseURL,
  });
  assert(
    result.status === 0,
    `CLI ${args.join(" ")} exited with ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  assert(result.stdout.includes(expectedOutput), `CLI ${args.join(" ")} stdout did not include ${expectedOutput}:\n${result.stdout}`);
}

function assertAllPilioRequestsAreAuthenticated() {
  const requests = [
    ...observed.fileCreates.map((request) => ({ label: "/v1/files/batch-create", auth: request.auth })),
    ...observed.taskCreates.map((request) => ({ label: request.path, auth: request.auth })),
    ...observed.taskStatuses.map((request) => ({ label: "/v1/tasks/:id/status", auth: request.auth })),
    ...observed.taskResults.map((request) => ({ label: "/v1/tasks/:id/result", auth: request.auth })),
  ];

  for (const request of requests) {
    assert(request.auth === "Bearer pilio_sk_test", `Pilio API key missing for ${request.label}`);
  }
}

function assertAllUploadsOmitAPIKey() {
  assert(observed.uploads.length === 6, `expected 6 presigned uploads, got ${observed.uploads.length}`);
  for (const upload of observed.uploads) {
    assert(upload.bytes > 0, `empty upload body for ${upload.path}`);
    assert(upload.auth === "", `Pilio API key was incorrectly sent to presigned upload URL ${upload.path}`);
  }
}

function assertTaskBody(path, assertBody) {
  const request = observed.taskCreates.find((item) => item.path === path && !item.asserted);
  assert(Boolean(request), `missing task request for ${path}`);
  request.asserted = true;
  assertBody(request.payload);
}

function assertHasFileID(body, label) {
  assert(typeof body.image_file_id === "string" && body.image_file_id.startsWith("file_"), `${label} did not use uploaded image file id`);
}

function json(res, body) {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readRequestBody(req) {
  return new Promise((resolveRead, rejectRead) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolveRead(Buffer.concat(chunks)));
    req.on("error", rejectRead);
  });
}

function currentBaseURL() {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Mock server did not expose a TCP address");
  }
  return `http://127.0.0.1:${address.port}`;
}

function runCLI(args, env) {
  return runProcess(process.execPath, [cliEntry, ...args], env);
}

function runProcess(command, args, env) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolveRun({ status, stdout, stderr });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
