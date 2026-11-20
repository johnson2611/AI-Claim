import type { ClaimStatus, Role } from "./schemas/claim";

export const STATUS_LABELS: Record<ClaimStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MORE_INFO_REQUIRED: "More information required",
  REVIEWED: "Reviewed",
};

interface Transition {
  to: ClaimStatus;
  roles: Role[];
}

const OFFICER_ROLES: Role[] = ["OFFICER", "ADMIN"];

/** The single source of truth for claim state changes (used by the API and the UI). */
const TRANSITIONS: Record<ClaimStatus, Transition[]> = {
  DRAFT: [{ to: "SUBMITTED", roles: ["CUSTOMER"] }],
  SUBMITTED: [{ to: "UNDER_REVIEW", roles: OFFICER_ROLES }],
  UNDER_REVIEW: [
    { to: "MORE_INFO_REQUIRED", roles: OFFICER_ROLES },
    { to: "REVIEWED", roles: OFFICER_ROLES },
  ],
  MORE_INFO_REQUIRED: [{ to: "SUBMITTED", roles: ["CUSTOMER"] }],
  REVIEWED: [],
};

export function canTransition(from: ClaimStatus, to: ClaimStatus, role: Role): boolean {
  return TRANSITIONS[from].some((t) => t.to === to && t.roles.includes(role));
}

export function allowedTransitions(from: ClaimStatus, role: Role): ClaimStatus[] {
  return TRANSITIONS[from].filter((t) => t.roles.includes(role)).map((t) => t.to);
}

export const CUSTOMER_EDITABLE_STATUSES: ClaimStatus[] = ["DRAFT", "MORE_INFO_REQUIRED"];
