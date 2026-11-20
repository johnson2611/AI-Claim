import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CUSTOMER_EDITABLE_STATUSES } from "@claims/shared";
import { api } from "../../lib/api/client";
import type { ClaimDetail } from "../../lib/api/types";
import { ClaimReceipt } from "./ClaimReceipt";
import { ClaimWizard } from "./ClaimWizard";

export function ClaimPage() {
  const { claimId } = useParams();
  const [claim, setClaim] = useState<ClaimDetail>();
  const [error, setError] = useState<string>();

  const load = useCallback(
    async (id: string) => {
      try {
        setClaim(await api<ClaimDetail>(`/api/claims/${id}`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load this report.");
      }
    },
    [],
  );

  useEffect(() => {
    if (claimId) void load(claimId);
  }, [claimId, load]);

  if (error) return <div className="note error" role="alert">{error}</div>;
  if (!claimId) return <ClaimWizard claim={undefined} reload={load} />;
  if (!claim) return <p>Loading…</p>;
  return CUSTOMER_EDITABLE_STATUSES.includes(claim.status) ? (
    <ClaimWizard claim={claim} reload={load} />
  ) : (
    <ClaimReceipt claim={claim} />
  );
}
