import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  FIREBASE_PROJECT_ID: z.string().min(1),
  // Photos are stored on local disk in this build, so the Firebase bucket is optional.
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  EVIDENCE_DIR: z.string().default("./data/evidence"),
  APPCHECK_ENFORCE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export const env = schema.parse(process.env);
