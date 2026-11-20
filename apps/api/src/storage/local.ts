import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env";

const ROOT = path.resolve(env.EVIDENCE_DIR);

/** Keys come from our own database, but never let one escape the evidence folder. */
function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function saveObject(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx" }); // never overwrite an existing object
}

export async function removeObject(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}

export async function statObject(key: string): Promise<{ size: number } | null> {
  try {
    const s = await stat(resolveKey(key));
    return s.isFile() ? { size: s.size } : null;
  } catch {
    return null;
  }
}

export function openObject(key: string): ReadStream {
  return createReadStream(resolveKey(key));
}
