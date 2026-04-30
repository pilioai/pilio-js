export class PilioAPIError extends Error {
  readonly code: number;
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, options: { code: number; status: number; data?: unknown }) {
    super(message);
    this.name = "PilioAPIError";
    this.code = options.code;
    this.status = options.status;
    this.data = options.data;
  }
}

export class PilioUploadError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "PilioUploadError";
    this.status = status;
  }
}

