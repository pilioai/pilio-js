import { describe, expect, it, vi } from "vitest";
import { createCommandRunner } from "../commands";

describe.each(["Flare", "Sunburst"] as const)("GPT Image 2.5 %s CLI", (variant) => {
  it("uploads references and calls the selected SDK model", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_25" });
    const upload = vi.fn().mockResolvedValue({ id: "ref_1" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { [`gptImage25${variant}`]: { create } }, files: { upload } } as never,
      fs: { readFile: async () => new Blob(["image"]), stat: async () => ({ size: 5 }) }, output,
    });
    await runner([`gpt-image-2.5-${variant.toLowerCase()}`, "--prompt", "product photo", "--input", "ref.png", "--resolution", "4K", "--aspect-ratio", "16:9"]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledExactlyOnceWith({ prompt: "product photo", image_file_ids: ["ref_1"], resolution: "4K", aspect_ratio: "16:9" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_25"));
  });

  it.each([["quality", "high"], ["output-count", "2"], ["aspect-ratio", "4:5"], ["resolution", "8K"]])("rejects --%s %s before upload", async (option, value) => {
    const create = vi.fn();
    const upload = vi.fn();
    const runner = createCommandRunner({ client: { images: { [`gptImage25${variant}`]: { create } }, files: { upload } } as never });
    await expect(runner([`gpt-image-2.5-${variant.toLowerCase()}`, "--prompt", "photo", "--input", "ref.png", `--${option}`, value!])).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
