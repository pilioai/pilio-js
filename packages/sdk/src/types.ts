import type { components } from "./generated/openapi";

export type TaskStatus = components["schemas"]["TaskStatus"];
export type TaskCreateResult = components["schemas"]["TaskCreateResult"];
export type TaskStatusResult = components["schemas"]["TaskStatusResult"];
export type TaskResult = components["schemas"]["TaskResult"];
export type ResultFile = components["schemas"]["ResultFile"];
export type FileUploadItem = components["schemas"]["FileUploadItem"];
export type GPTImage2Request = components["schemas"]["GPTImage2Request"];
export type NanoBanana2Request = components["schemas"]["NanoBanana2Request"];

type OptionalDefaults<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RemoveImageWatermarkRequest = OptionalDefaults<components["schemas"]["RemoveImageWatermarkRequest"], "mode">;
export type RemoveBackgroundRequest = OptionalDefaults<
  components["schemas"]["RemoveBackgroundRequest"],
  "industry_type" | "quality_type" | "trim_transparent_background"
>;
export type ImageUpscaleRequest = OptionalDefaults<components["schemas"]["ImageUpscaleRequest"], "method" | "preset" | "type">;
export type PDFRemoveWatermarkRequest = OptionalDefaults<components["schemas"]["PDFRemoveWatermarkRequest"], "mode">;

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type PilioClientOptions = {
  apiKey: string;
  baseURL?: string;
  fetch?: FetchLike;
};

export type UploadFileInput = {
  name: string;
  type: string;
  data: BodyInit;
  size?: number;
  nanoid?: string;
};

export type WaitTaskOptions = {
  intervalMs?: number;
  timeoutMs?: number;
};
