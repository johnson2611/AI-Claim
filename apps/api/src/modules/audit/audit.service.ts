import type { ClaimStatus, Prisma } from "@prisma/client";
import { prisma } from "../../db/client";

type Db = Prisma.TransactionClient | typeof prisma;

interface EventInput {
  claimId: string;
  actorId: string;
  eventType: string;
  fromStatus?: ClaimStatus;
  toStatus?: ClaimStatus;
  /** Field names, routes and counts only. Never claim text, images or other personal content. */
  metadata?: Prisma.InputJsonValue;
}

export function recordEvent(db: Db, e: EventInput) {
  return db.claimEvent.create({
    data: {
      claimId: e.claimId,
      actorId: e.actorId,
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      metadata: e.metadata,
    },
  });
}
