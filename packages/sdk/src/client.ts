import { PilioAPIError, PilioUploadError } from "./errors";
import type {
  FileUploadItem,
  FetchLike,
  GPTImage2Request,
  ImageUpscaleRequest,
  NanoBanana2Request,
  PDFRemoveWatermarkRequest,
  PilioClientOptions,
  RemoveBackgroundRequest,
  RemoveImageWatermarkRequest,
  TaskCreateResult,
  TaskResult,
  TaskStatusResult,
  UploadFileInput,
  WaitTaskOptions,
} from "./types";

type ResponseEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

const DEFAULT_BASE_URL = "https://pilio.ai";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createNanoid(size = 21) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const bytes = new Uint8Array(size);
  globalThis.crypto?.getRandomValues?.(bytes);
  if (!bytes.some((byte) => byte > 0)) {
    for (let i = 0; i < size; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function requireData<T>(envelope: ResponseEnvelope<T>, path: string): T {
  if (envelope.data === undefined || envelope.data === null) {
    throw new PilioAPIError(`Pilio API response for ${path} did not include data`, {
      code: envelope.code,
      status: 200,
      data: envelope.data,
    });
  }
  return envelope.data;
}

export class PilioClient {
  readonly apiKey: string;
  readonly baseURL: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: PilioClientOptions) {
    if (!options.apiKey) {
      throw new Error("Pilio API key is required");
    }
    this.apiKey = options.apiKey;
    this.baseURL = trimTrailingSlash(options.baseURL ?? DEFAULT_BASE_URL);
    this.fetchImpl = options.fetch ?? fetch;
  }

  readonly images = {
    gptImage2: {
      create: (input: GPTImage2Request) => this.post<TaskCreateResult>("/v1/images/gpt-image-2", input),
    },
    nanoBanana2: {
      create: (input: NanoBanana2Request) => this.post<TaskCreateResult>("/v1/images/nano-banana-2", input),
    },
    removeWatermark: (input: RemoveImageWatermarkRequest) =>
      this.post<TaskCreateResult>("/v1/images/remove-watermark", input),
    removeBackground: (input: RemoveBackgroundRequest) => this.post<TaskCreateResult>("/v1/images/remove-background", input),
    upscale: (input: ImageUpscaleRequest) => this.post<TaskCreateResult>("/v1/images/upscale", input),
  };

  readonly pdfs = {
    removeWatermark: (input: PDFRemoveWatermarkRequest) => this.post<TaskCreateResult>("/v1/pdfs/remove-watermark", input),
  };

  readonly tasks = {
    status: (taskId: string) => this.get<TaskStatusResult>(`/v1/tasks/${encodeURIComponent(taskId)}/status`),
    result: (taskId: string) => this.get<TaskResult>(`/v1/tasks/${encodeURIComponent(taskId)}/result`),
    wait: async (taskId: string, options: WaitTaskOptions = {}) => {
      const intervalMs = options.intervalMs ?? 2_000;
      const timeoutMs = options.timeoutMs ?? 10 * 60_000;
      const startedAt = Date.now();

      while (Date.now() - startedAt <= timeoutMs) {
        const status = await this.tasks.status(taskId);
        if (status.status === "Succeeded") {
          return this.tasks.result(taskId);
        }
        if (status.status === "Failed") {
          throw new PilioAPIError(status.error_message ?? "Pilio task failed", {
            code: 200,
            status: 200,
            data: status,
          });
        }
        await sleep(intervalMs);
      }

      throw new Error(`Timed out waiting for Pilio task ${taskId}`);
    },
  };

  readonly files = {
    create: (files: Array<Omit<UploadFileInput, "data">>, options: { upload_mode?: "auto" | "simple" | "multipart" } = {}) =>
      this.post<{ total?: number; items?: FileUploadItem[] }>("/v1/files/batch-create", {
        files: files.map((file) => ({
          nanoid: file.nanoid ?? createNanoid(),
          name: file.name,
          type: file.type,
          size: file.size,
        })),
        upload_mode: options.upload_mode ?? "simple",
        storage_intent: "temporary",
      }),
    upload: async (file: UploadFileInput): Promise<FileUploadItem> => {
      const created = await this.files.create([file], { upload_mode: "simple" });
      const item = created.items?.[0];
      if (!item?.id || !item.upload_url) {
        throw new PilioAPIError("Pilio did not return a simple upload_url", {
          code: 200,
          status: 200,
          data: created,
        });
      }

      const response = await this.fetchImpl(item.upload_url, {
        method: "PUT",
        body: file.data,
        headers: {},
      });
      if (!response.ok) {
        throw new PilioUploadError(`Pilio presigned upload failed with HTTP ${response.status}`, response.status);
      }

      return item;
    },
  };

  private async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
    };
    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers["content-type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await this.fetchImpl(`${this.baseURL}${path}`, init);
    const responseText = await response.text();
    let envelope: ResponseEnvelope<T> | undefined;
    try {
      envelope = JSON.parse(responseText) as ResponseEnvelope<T>;
    } catch {
      throw new PilioAPIError(`Pilio API request failed with HTTP ${response.status}`, {
        code: response.status,
        status: response.status,
        data: { body: responseText.slice(0, 500) },
      });
    }

    if (!response.ok || envelope.code !== 200) {
      throw new PilioAPIError(envelope.message || `Pilio API request failed with HTTP ${response.status}`, {
        code: envelope.code,
        status: response.status,
        data: envelope.data,
      });
    }

    return requireData(envelope, path);
  }
}
