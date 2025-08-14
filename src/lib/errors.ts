export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public hint?: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const isHttpError = (e: unknown): e is HttpError => e instanceof HttpError;

