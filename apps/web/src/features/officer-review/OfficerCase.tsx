import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { allowedTransitions, EVIDENCE_LABEL_TEXT, type EvidenceLabel } from "@claims/shared";
import { useAuth } from "../../app/AuthProvider";
import { EvidenceThumb } from "../../components/EvidenceThumb";
import { RouteBadge } from "../../components/RouteBadge";
import { StatusPill } from "../../components/StatusPill";
import { api } from "../../lib/api/client";
import { eventText } from "../../lib/format";
import type { ClaimDetail, ClaimEventItem } from "../../lib/api/types";

export function OfficerCase() {
  const { claimId = "" } = useParams();
  const { role } = useAuth();
  const [claim, setClaim] = useState<ClaimDetail>();
  const [events, setEvents] = useState<ClaimEventItem[]>([]);
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      const [c, ev] = await Promise.all([
        api<ClaimDetail>(`/api/claims/${claimId}`),
        api<ClaimEventItem[]>(`/api/claims/${claimId}/events`),
      ]);
      setClaim(c);
      setEvents(ev);
      setSummary((prev) => prev || c.officerSummary || c.aiDraft?.incident_summary || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this case.");
    }
  }, [claimId]);
  useEffect(() => { void load(); }, [load]);

  async function review(action: "START_REVIEW" | "REQUEST_MORE_INFO" | "MARK_REVIEWED") {
    setError(undefined);
    try {
      await api(`/api/officer/claims/${claimId}/review`, {
        method: "POST",
        body: { action, officerSummary: summary || undefined, message: message || undefined },
      });
      setMessage("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record that action.");
    }
  }

  if (error && !claim) return <div className="note error" role="alert">{error}</div>;
  if (!claim || !role) return <p>Loading…</p>;
  const next = allowedTransitions(claim.status, role);

  return (
    <section>
      <h1>{claim.publicReference} <StatusPill status={claim.status} /></h1>
      {error && <div className="note error" role="alert">{error}</div>}
      <div className="split">
        <div className="panel">
          <h2>Customer statement (original)</h2>
          <p>{claim.narrative}</p>
          <p className="hint">
            {claim.incidentType} at {claim.incidentLocation}. Vehicle: {claim.vehicleDescription}. Injuries reported: {claim.injuriesReported ? "yes" : "no"}. Policy: {claim.policyReferenceMasked}.
          </p>
        </div>
        <div className="panel">
          <h2>AI-assisted draft (unverified)</h2>
          {claim.aiDraft ? (
            <>
              <p>{claim.aiDraft.incident_summary || "No text summary was drafted."}</p>
              {claim.aiDraft.missing_information.length > 0 && <><h3>Flagged as missing</h3><ul className="plain">{claim.aiDraft.missing_information.map((m) => <li key={m}>{m}</li>)}</ul></>}
              {claim.aiDraft.uncertainties.length > 0 && <><h3>Uncertainties</h3><ul className="plain">{claim.aiDraft.uncertainties.map((m) => <li key={m}>{m}</li>)}</ul></>}
              {claim.aiDraft.photo_observations && claim.aiDraft.photo_observations.length > 0 && (
                <>
                  <h3>Photo observations (unverified)</h3>
                  <ul className="plain">
                    {claim.aiDraft.photo_observations.map((o) => (
                      <li key={o.evidence_id}>
                        <strong>{EVIDENCE_LABEL_TEXT[o.label as EvidenceLabel] ?? o.label}:</strong> {o.visible_description}{" "}
                        <span className="hint">(photo looks {o.photo_quality}; matches label: {o.matches_label})</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="hint">{claim.aiDraft.safety_notice}</p>
            </>
          ) : <p>The customer did not use AI help.</p>}
        </div>
      </div>

      <div className="panel">
        <h2>Evidence</h2>
        <div className="thumbs">
          {claim.evidence.map((e) => <EvidenceThumb key={e.id} claimId={claim.id} evidenceId={e.id} label={EVIDENCE_LABEL_TEXT[e.label as EvidenceLabel] ?? e.label} />)}
        </div>
        <p className="hint">
          Completeness {claim.completeness.percent}%. Missing: {[...claim.completeness.missingFields, ...claim.completeness.missingEvidence].join(", ") || "nothing required"}.
        </p>
      </div>

      <div className="panel">
        <h2>Your review</h2>
        <div className="field">
          <label htmlFor="osum">Reviewed summary (you are responsible for this text)</label>
          <textarea id="osum" value={summary} onChange={(e) => setSummary(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="omsg">Message to customer (required to request more information)</label>
          <input id="omsg" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div className="row">
          {next.includes("UNDER_REVIEW") && <button onClick={() => void review("START_REVIEW")}>Start review</button>}
          {next.includes("MORE_INFO_REQUIRED") && <button className="secondary" disabled={!message} onClick={() => void review("REQUEST_MORE_INFO")}>Request more information</button>}
          {next.includes("REVIEWED") && <button disabled={!summary} onClick={() => void review("MARK_REVIEWED")}>Mark as reviewed</button>}
          {next.length === 0 && <span className="hint">No further actions for this status.</span>}
        </div>
        <p className="hint">This records triage notes only. It does not approve, reject, price or settle the claim.</p>
      </div>

      <div className="split">
        <div className="panel table-wrap">
          <h3>AI runs</h3>
          <table>
            <thead><tr><th>Route</th><th>Task</th><th>Result</th><th>Latency</th></tr></thead>
            <tbody>
              {claim.analyses.map((a) => (
                <tr key={a.id}><td><RouteBadge route={a.route} /></td><td>{a.taskType}</td><td>{a.status}{a.fallbackReason ? ` (${a.fallbackReason})` : ""}</td><td>{a.latencyMs} ms</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Audit trail</h3>
          <ul className="plain">
            {events.map((e) => <li key={e.id}>{new Date(e.createdAt).toLocaleString()}: {eventText(e)}{e.toStatus ? ` → ${e.toStatus}` : ""}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
