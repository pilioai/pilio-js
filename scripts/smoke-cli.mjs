import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const repoRoot = resolve(import.meta.dirname, "..");
const cliEntry = resolve(repoRoot, "packages", "cli", "dist", "index.js");
const tmpDir = await mkdtemp(join(tmpdir(), "pilio-cli-smoke-"));
const inputPath = join(tmpDir, "portrait.png");

await writeFile(inputPath, new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4]));

const observed = {
  createFileAuth: "",
  uploadAuth: "",
  removeBackgroundAuth: "",
  removeBackgroundBody: undefined,
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const body = await readRequestBody(req);

  if (req.method === "POST" && url.pathname === "/v1/files/batch-create") {
    const uploadURL = `${currentBaseURL()}/upload/file_1`;
    observed.createFileAuth = req.headers.authorization ?? "";
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        code: 200,
        message: "ok",
        data: {
          total: 1,
          items: [
            {
              id: "file_1",
              name: "portrait.png",
              type: "png",
              upload_url: uploadURL,
            },
          ],
        },
      }),
    );
    return;
  }

  if (req.method === "PUT" && url.pathname === "/upload/file_1") {
    observed.uploadAuth = req.headers.authorization ?? "";
    res.statusCode = body.length > 0 ? 200 : 400;
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/images/remove-background") {
    observed.removeBackgroundAuth = req.headers.authorization ?? "";
    observed.removeBackgroundBody = JSON.parse(body.toString("utf8"));
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        code: 200,
        message: "ok",
        data: {
          task_id: "task_smoke_1",
          status: "Pending",
          status_url: "/v1/tasks/task_smoke_1/status",
          result_url: "/v1/tasks/task_smoke_1/result",
        },
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.end(`unexpected ${req.method} ${url.pathname}`);
});

await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("Mock server did not expose a TCP address");
}
const baseURL = `http://127.0.0.1:${address.port}`;

try {
  const result = await runNode([
    cliEntry,
    "remove-background",
    "--input",
    inputPath,
  ], {
    PILIO_API_KEY: "pilio_sk_test",
    PILIO_BASE_URL: baseURL,
  });

  assert(result.status === 0, `CLI exited with ${result.status}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  assert(result.stdout.includes("task_smoke_1"), `CLI stdout did not include task id:\n${result.stdout}`);
  assert(observed.createFileAuth === "Bearer pilio_sk_test", "Pilio API key was not sent to /v1/files/batch-create");
  assert(observed.removeBackgroundAuth === "Bearer pilio_sk_test", "Pilio API key was not sent to /v1/images/remove-background");
  assert(observed.uploadAuth === "", "Pilio API key was incorrectly sent to presigned upload URL");
  assert(observed.removeBackgroundBody?.image_file_id === "file_1", "remove-background did not use uploaded file id");

  console.log("CLI smoke passed");
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(tmpDir, { recursive: true, force: true });
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

function runNode(args, env) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, args, {
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
