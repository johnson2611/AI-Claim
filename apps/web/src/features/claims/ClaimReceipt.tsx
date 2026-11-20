import { useEffect, useState } from "react";
import { STATUS_LABELS } from "@claims/shared";
import { StatusPill } from "../../components/StatusPill";
import { api } from "../../lib/api/client";
import { eventText } from "../../lib/format";
import type { ClaimDetail, ClaimEventItem } from "../../lib/api/types";

export function ClaimReceipt({ claim }: { claim: ClaimDetail }) {
  const [events, setEvents] = useState<ClaimEventItem[]>([]);
  useEffect(() => {
    api<ClaimEventItem[]>(`/api/claims/${claim.id}/events`).then(setEvents).catch(() => undefined);
  }, [claim.id]);
  const request = [...events].reverse().find((e) => e.eventType === "MORE_INFO_REQUESTED");

  return (
    <section>
      <h1>Report received</h1>
      <div className="panel">
        <p>Your reference number</p>
        <h2>{claim.publicReference}</h2>
        <p>
          Status: <StatusPill status={claim.status} />
          {claim.submittedAt && <> &nbsp; Submitted {new Date(claim.submittedAt).toLocaleString()}</>}
        </p>
        <p>A claims officer will review your report. We will tell you if more information is needed. Nothing has been approved or decided yet.</p>
      </div>
      {request?.metadata?.message ? <div className="note warn">Message from the claims team: {String(request.metadata.message)}</div> : null}
      <div className="panel">
        <h3>History</h3>
        <ul className="plain">
          {events.map((e) => (
            <li key={e.id}>
              {new Date(e.createdAt).toLocaleString()}: {e.toStatus ? STATUS_LABELS[e.toStatus] : eventText(e)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
