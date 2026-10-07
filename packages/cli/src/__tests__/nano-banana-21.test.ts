import { describe, expect, it, vi } from "vitest";
import { createCommandRunner } from "../commands";

describe("Nano Banana 2.1 CLI", () => {
  it("uploads references and calls the SDK", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_nb21" });
    const upload = vi.fn().mockResolvedValue({ id: "ref_1" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { nanoBanana21: { create } }, files: { upload } } as never,
      fs: { readFile: async () => new Blob(["image"]), stat: async () => ({ size: 5 }) }, output,
    });
    await runner(["nano-banana-2.1", "--prompt", "poster", "--input", "ref.png", "--resolution", "4K", "--aspect-ratio", "8:1"]);
    expect(create).toHaveBeenCalledExactlyOnceWith({ prompt: "poster", image_file_ids: ["ref_1"], resolution: "4K", aspect_ratio: "8:1" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_nb21"));
  });

  it.each([
    [["--aspect-ratio", "auto"]],
    [["--aspect-ratio", "1:1", "--resolution", "0.5K"]],
    [["--aspect-ratio", "1:1", "--output-count", "2"]],
    [["--aspect-ratio", "1:1", "--quality", "high"]],
    [[]],
  ])("rejects invalid options %j before calling the API", async (extra) => {
    const create = vi.fn();
    const runner = createCommandRunner({ client: { images: { nanoBanana21: { create } } } as never });
    await expect(runner(["nano-banana-2.1", "--prompt", "poster", ...extra])).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
});
