import { describe, expect, it, vi } from "vitest";
import { PilioAPIError, PilioClient } from "../index";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("PilioClient", () => {
  it("sends bearer API key to Pilio API requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 200, message: "ok", data: { task_id: "task_1", status: "Pending", status_url: "/v1/tasks/task_1/status", result_url: "/v1/tasks/task_1/result" } }));
    const client = new PilioClient({ apiKey: "pilio_sk_test", baseURL: "https://example.test", fetch: fetchMock });

    await client.images.gptImage2.generate({ prompt: "hello", aspect_ratio: "1:1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/images/gpt-image-2/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer pilio_sk_test",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("throws PilioAPIError for non-200 envelope codes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ code: 1402, message: "invalid api key", data: { reason: "invalid_api_key" } }, { status: 401 }));
    const client = new PilioClient({ apiKey: "pilio_sk_bad", baseURL: "https://example.test", fetch: fetchMock });

    await expect(client.tasks.status("task_1")).rejects.toMatchObject({
      name: "PilioAPIError",
      code: 1402,
      status: 401,
      data: { reason: "invalid_api_key" },
    } satisfies Partial<PilioAPIError>);
  });

  it("polls a task until it succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, message: "ok", data: { task_id: "task_1", status: "Processing" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, message: "ok", data: { task_id: "task_1", status: "Succeeded" } }))
      .mockResolvedValueOnce(jsonResponse({ code: 200, message: "ok", data: { task_id: "task_1", status: "Succeeded", files: [{ id: "file_1", download_url: "https://download.test/file.png" }] } }));
    const client = new PilioClient({ apiKey: "pilio_sk_test", baseURL: "https://example.test", fetch: fetchMock });

    const result = await client.tasks.wait("task_1", { intervalMs: 1, timeoutMs: 100 });

    expect(result.status).toBe("Succeeded");
    expect(result.files?.[0]?.download_url).toBe("https://download.test/file.png");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uploads a local file through presigned upload_url without sending the API key", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ code: 200, message: "ok", data: { total: 1, items: [{ id: "file_1", upload_url: "https://upload.test/file_1", name: "input.png", type: "png" }] } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const client = new PilioClient({ apiKey: "pilio_sk_test", baseURL: "https://example.test", fetch: fetchMock });

    const file = await client.files.upload({
      name: "input.png",
      type: "png",
      data: new Uint8Array([1, 2, 3]),
      size: 3,
    });

    expect(file.id).toBe("file_1");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://upload.test/file_1",
      expect.objectContaining({
        method: "PUT",
        body: expect.any(Uint8Array),
        headers: expect.not.objectContaining({
          authorization: expect.any(String),
        }),
      }),
    );
  });
});
