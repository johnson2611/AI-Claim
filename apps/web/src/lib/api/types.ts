import type { AiSummary, ClaimStatus, Completeness } from "@claims/shared";

export interface EvidenceItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  label: string;
  uploadedAt: string | null;
}

export interface AnalysisItem {
  id: string;
  taskType: string;
  route: "ON_DEVICE" | "IN_CLOUD";
  fallbackReason: string | null;
  status: string;
  latencyMs: number;
  promptVersion: string;
  createdAt: string;
}

export interface ClaimDetail {
  id: string;
  publicReference: string;
  status: ClaimStatus;
  policyReferenceMasked: string | null;
  incidentAt: string | null;
  incidentLocation: string | null;
  incidentType: string | null;
  narrative: string | null;
  vehicleDescription: string | null;
  injuriesReported: boolean | null;
  otherPartiesInvolved: boolean | null;
  contactChannel: string | null;
  aiDraft: AiSummary | null;
  officerSummary: string | null;
  submittedAt: string | null;
  evidence: EvidenceItem[];
  analyses: AnalysisItem[];
  consents: { purpose: string; grantedAt: string; withdrawnAt: string | null }[];
  completeness: Completeness;
}

export interface ClaimEventItem {
  id: string;
  eventType: string;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  publicReference: string;
  status: ClaimStatus;
  incidentType: string | null;
  submittedAt: string | null;
  completenessPercent: number;
}
