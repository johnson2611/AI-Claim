import { HttpError } from "../middleware/errors";

/** Route params are typed loosely by Express; read them through this so handlers always get a string. */
export function param(req: { params: unknown }, name: string): string {
  const value = (req.params as Record<string, string | string[] | undefined>)[name];
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    throw new HttpError(400, `Missing or invalid ${name}.`);
  }
  return value;
}
