import { STATUS_LABELS, type ClaimStatus } from "@claims/shared";

export function StatusPill({ status }: { status: ClaimStatus }) {
  return <span className={`pill ${status}`}>{STATUS_LABELS[status]}</span>;
}
