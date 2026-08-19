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

  it("preserves auto aspect ratio when creating a high-resolution GPT Image 2 task", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_high_res", status: "Pending" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { gptImage2: { create } } } as never,
      output,
    });

    await runner(["gpt-image-2", "--prompt", "hello", "--aspect-ratio", "auto", "--resolution", "2K"]);

    expect(create).toHaveBeenCalledWith({ prompt: "hello", aspect_ratio: "auto", resolution: "2K" });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_high_res"));
  });

  it("rejects invalid GPT Image 2 resolution before uploading or creating a task", async () => {
    const upload = vi.fn();
    const create = vi.fn().mockResolvedValue({ task_id: "task_ignored", status: "Pending" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: {
        files: { upload },
        images: { gptImage2: { create } },
      } as never,
      output,
    });

    await expect(
      runner([
        "gpt-image-2",
        "--input",
        "reference.png",
        "--prompt",
        "hello",
        "--aspect-ratio",
        "16:9",
        "--resolution",
        "8K",
      ]),
    ).rejects.toThrow("Option --resolution must be one of: 1K, 2K, 4K");
    expect(upload).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects unsupported GPT Image 2 high-resolution aspect ratio combinations before upload", async () => {
    const upload = vi.fn();
    const create = vi.fn();
    const runner = createCommandRunner({
      client: {
        files: { upload },
        images: { gptImage2: { create } },
      } as never,
    });

    await expect(
      runner([
        "gpt-image-2",
        "--input",
        "reference.png",
        "--prompt",
        "hello",
        "--aspect-ratio",
        "4:5",
        "--resolution",
        "4K",
      ]),
    ).rejects.toThrow("GPT Image 2 4K does not support aspect ratio 4:5");
    expect(upload).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
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

  it("delegates Nano Banana Pro creation to the unified SDK method", async () => {
    const create = vi.fn().mockResolvedValue({ task_id: "task_nb_pro_1", status: "Pending" });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: { images: { nanoBananaPro: { create } } } as never,
      output,
    });

    await runner(["--help"]);
    expect(output).toHaveBeenCalledWith(expect.stringContaining("nano-banana-pro"));

    await runner(["nano-banana-pro", "--prompt", "hello", "--aspect-ratio", "1:1", "--resolution", "4K", "--output-count", "2"]);

    expect(create).toHaveBeenCalledWith({ prompt: "hello", aspect_ratio: "1:1", resolution: "4K", output_count: 2 });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_nb_pro_1"));
  });

  it("uploads reference images before Nano Banana Pro creation", async () => {
    const upload = vi.fn().mockResolvedValue({ id: "file_1" });
    const create = vi.fn().mockResolvedValue({ task_id: "task_nb_pro_2", status: "Pending" });
    const readFile = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const stat = vi.fn().mockResolvedValue({ size: 3 });
    const output = vi.fn();
    const runner = createCommandRunner({
      client: {
        files: { upload },
        images: { nanoBananaPro: { create } },
      } as never,
      fs: { readFile, stat },
      output,
    });

    await runner(["nano-banana-pro", "--input", "reference.png", "--prompt", "make it premium"]);

    expect(upload).toHaveBeenCalledWith(expect.objectContaining({ name: "reference.png", type: "png", size: 3 }));
    expect(create).toHaveBeenCalledWith({ prompt: "make it premium", image_file_ids: ["file_1"] });
    expect(output).toHaveBeenCalledWith(expect.stringContaining("task_nb_pro_2"));
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
