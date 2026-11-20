import type { RequestHandler } from "express";
import type { Role } from "@claims/shared";
import { adminAppCheck, adminAuth } from "../config/firebase";
import { env } from "../config/env";
import { prisma } from "../db/client";
import { HttpError } from "./errors";

/** Verifies the Firebase ID token. The role always comes from OUR database, never from the client. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new HttpError(401, "Sign in to continue.");

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await adminAuth.verifyIdToken(header.slice("Bearer ".length));
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    throw new HttpError(401, "Your session has expired. Sign in again.");
  }

  const user = await prisma.user.upsert({
    where: { identitySubject: uid },
    update: {},
    create: { identitySubject: uid, email: email ?? null, role: "CUSTOMER" },
  });
  if (user.disabledAt) throw new HttpError(403, "This account is disabled.");

  req.user = { id: user.id, role: user.role };
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "You do not have access to this area.");
    }
    next();
  };
}

/** Optional second layer: verify Firebase App Check tokens on API calls too. */
export const verifyAppCheck: RequestHandler = async (req, _res, next) => {
  if (!env.APPCHECK_ENFORCE) return next();
  const token = req.header("X-Firebase-AppCheck");
  if (!token) throw new HttpError(401, "App attestation is required.");
  try {
    await adminAppCheck.verifyToken(token);
  } catch {
    throw new HttpError(401, "App attestation failed.");
  }
  next();
};

export function currentUser(req: Express.Request) {
  if (!req.user) throw new HttpError(401, "Sign in to continue.");
  return req.user;
}
