import rateLimit from "express-rate-limit";

const base = { standardHeaders: true, legacyHeaders: false } as const;

export const globalLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 600 });
export const writeLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 30 });
export const uploadLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 20 });
export const aiTelemetryLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 40 });
