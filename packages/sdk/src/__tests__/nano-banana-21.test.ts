import { describe, expect, it, vi } from "vitest";
import { PilioClient, type NanoBanana21Request } from "../index";

describe("Nano Banana 2.1", () => {
  it.each(["create", "quote"] as const)("%s posts to the dedicated endpoint", async (operation) => {
    const data = operation === "quote" ? { charged_credits: "4.00" } : { task_id: "task_nb21" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data })));
    const client = new PilioClient({ apiKey: "test_key", baseURL: "https://example.test", fetch });
    const input: NanoBanana21Request = { prompt: "poster", aspect_ratio: "4:5", resolution: "2K" };
    expect(await client.images.nanoBanana21[operation](input)).toEqual(data);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://example.test/v1/images/nano-banana-2.1${operation === "quote" ? "/quote" : ""}`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(input) }),
    );
  });
});
