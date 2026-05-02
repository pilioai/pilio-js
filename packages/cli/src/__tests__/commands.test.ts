import { describe, expect, it, vi } from "vitest";
import { createCommandRunner } from "../commands";

describe("CLI command runner", () => {
  it("delegates GPT Image 2 creation to the unified SDK method", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_1", status: "Pending" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { gptImage2: { create } } } as never,
      output,
    });

    await runner(["gpt-image-2", "--prompt", "hello", "--aspect-ratio", "1:1"]);

    expect(create).toHaveBeenCalledWith({ prompt: "hello", aspect_ratio: "1:1" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_1"));
  });

  it("uploads reference images before GPT Image 2 creation", async () => {
    const upload = vi.fn().mockResolvedValue({ id: "file_1" });
    const create = vi.fn().mockResolvedValue({ task_id: "task_2", status: "Pending" });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const stat = vi.fn().mockResolvedValue({ size: 3 });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: {
        files: { upload },
        images: { gptImage2: { create } },
      } as never,
      fs: { readFile, stat },
      output,
    });

    await runner(["gpt-image-2", "--input", "reference.png", "--prompt", "make it crisp"]);

    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: "reference.png", type: "png", size: 3 }));
    expect(create).toHaveBeenCalledWith({ prompt: "make it crisp", image_file_ids: ["file_1"] });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_2"));
  });

  it("delegates Nano Banana 2 creation to the unified SDK method", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_nb_1", status: "Pending" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { nanoBanana2: { create } } } as never,
      output,
    });

    await runner(["nano-banana-2", "--prompt", "hello", "--aspect-ratio", "1:1", "--resolution", "1K"]);

    expect(create).toHaveBeenCalledWith({ prompt: "hello", aspect_ratio: "1:1", resolution: "1K" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_nb_1"));
  });

  it("uploads an input file before remove-background", async () => {
    const upload = vi.fn().mockResolvedValue({ id: "file_1" });
    const removeBackground = vi.fn().mockResolvedValue({ task_id: "task_2", status: "Pending" });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const stat = vi.fn().mockResolvedValue({ size: 3 });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: {
        files: { upload },
        images: { removeBackground },
      } as never,
      fs: { readFile, stat },
      output,
    });

    await runner(["remove-background", "--input", "portrait.png"]);

    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: "portrait.png", type: "png", size: 3 }));
    expect(removeBackground).toHaveBeenCalledWith({ image_file_id: "file_1" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_2"));
  });

  it("prints help for unknown commands", async () => {
    const output = vi.fn();
    const runner = createCommandRunner({ client: {} as never, output });

    await expect(runner(["unknown"])).rejects.toThrow("Unknown command: unknown");
    expect(output).toHaveBeenCalledWith(expect.stringContaining("Usage: pilio"));
  });
});
