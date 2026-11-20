import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) => next(new HttpError(404, "Not found"));

/** Consistent error shape. Never echoes request bodies (they may contain claim text). */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_FAILED",
      message: "The request data is not valid.",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: codeFor(err.status), message: err.message, details: err.details });
    return;
  }
  console.error(JSON.stringify({ level: "error", method: req.method, path: req.path, name: err?.name }));
  res.status(500).json({ error: "INTERNAL", message: "Something went wrong. Please try again." });
};

function codeFor(status: number): string {
  const codes: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHENTICATED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "UNPROCESSABLE",
    429: "RATE_LIMITED",
  };
  return codes[status] ?? "ERROR";
}
