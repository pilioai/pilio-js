import { describe, expect, it, vi } from "vitest";
import { PilioClient, PilioAPIError, type GPTImage25Request } from "../index";

describe.each(["Flare", "Sunburst"] as const)("GPT Image 2.5 %s", (variant) => {
  it.each(["create", "quote"] as const)("%s preserves the exact variant and request", async (operation) => {
    const data = operation === "quote" ? { charged_credits: "8.34" } : { task_id: "task_25" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data })));
    const client = new PilioClient({ apiKey: "test_key", baseURL: "https://example.test", fetch });
    const input: GPTImage25Request = { prompt: "product photo", image_file_ids: ["reference_1"], resolution: "2K", aspect_ratio: "auto", quality: "auto", output_count: 1 };
    const result = await client.images[`gptImage25${variant}`][operation](input);
    expect(result).toEqual(data);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `https://example.test/v1/images/gpt-image-2.5-${variant.toLowerCase()}${operation === "quote" ? "/quote" : ""}`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(input), headers: expect.objectContaining({ authorization: "Bearer test_key" }) }),
    );
  });

  it("does not fall back to Image 2 if the server lacks Image 2.5", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 404, message: "not found" }), { status: 404 }));
    const client = new PilioClient({ apiKey: "test_key", fetch });
    await expect(client.images[`gptImage25${variant}`].create({ prompt: "product photo" })).rejects.toBeInstanceOf(PilioAPIError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
