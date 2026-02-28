export class HttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class YouTubeApiError extends Error {
  status: number;
  reason?: string;
  raw?: unknown;

  constructor(message: string, status: number, reason?: string, raw?: unknown) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.raw = raw;
  }
}

export function isQuotaError(reason?: string): boolean {
  return (
    reason === "quotaExceeded" ||
    reason === "dailyLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "rateLimitExceeded"
  );
}
