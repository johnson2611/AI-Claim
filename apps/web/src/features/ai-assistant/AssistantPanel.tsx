import { useState } from "react";
import type { AiSummary } from "@claims/shared";
import { RouteBadge } from "../../components/RouteBadge";
import { api } from "../../lib/api/client";
import type { ClaimDetail } from "../../lib/api/types";
import { AiTaskError, generateCaseSummary } from "./caseSummary";

interface Props {
  claim: ClaimDetail;
  onChanged: () => void;
}

export function AssistantPanel({ claim, onChanged }: Props) {
  const hasConsent = claim.consents.some((c) => c.purpose === "CLOUD_AI_PROCESSING" && !c.withdrawnAt);
  const [cloudConsent, setCloudConsent] = useState(hasConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ summary: AiSummary; route: "ON_DEVICE" | "IN_CLOUD"; fallback?: string }>();
  const [text, setText] = useState(claim.aiDraft?.incident_summary ?? "");

  async function toggleConsent(next: boolean) {
    setCloudConsent(next);
    if (next && !hasConsent) {
      await api(`/api/claims/${claim.id}/consents`, { method: "POST", body: { purpose: "CLOUD_AI_PROCESSING" } }).catch(() =>
        setError("Could not record your choice. Cloud AI stays off."),
      );
    }
  }

  async function draft() {
    setBusy(true);
    setError(undefined);
    try {
      const { summary, telemetry } = await generateCaseSummary(
        { ...claim, evidenceLabels: claim.evidence.map((e) => e.label) },
        cloudConsent,
      );
      setResult({ summary, route: telemetry.route, fallback: telemetry.fallbackReason });
      setText(summary.incident_summary);
      void api(`/api/claims/${claim.id}/ai-analyses`, { method: "POST", body: telemetry }).catch(() => undefined);
    } catch (e) {
      if (e instanceof AiTaskError) {
        void api(`/api/claims/${claim.id}/ai-analyses`, { method: "POST", body: e.telemetry }).catch(() => undefined);
        setError(
          cloudConsent
            ? "AI help could not finish. You can still complete the report yourself."
            : "On-device AI is not available in this browser. Turn on cloud AI below, or continue without AI help.",
        );
      } else setError("AI help is unavailable right now. You can still complete the report yourself.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const base = result?.summary ?? claim.aiDraft;
    if (!base) return;
    await api(`/api/claims/${claim.id}/ai-draft`, { method: "PUT", body: { ...base, incident_summary: text } });
    onChanged();
  }

  const shown = result?.summary ?? claim.aiDraft;
  return (
    <section>
      <h2>AI help (optional)</h2>
      <div className="note ai">
        AI-generated draft. Human review required. It will not decide your claim. Photos are not sent to any AI.
      </div>
      <p className="hint">
        Sent to the AI: incident type, time, location, vehicle, injury answers and your description (phone numbers
        and emails removed). Not sent: policy reference, contact details, photos.
      </p>
      <label className="choice">
        <input type="checkbox" checked={cloudConsent} onChange={(e) => void toggleConsent(e.target.checked)} />
        If my device cannot run the AI locally, allow cloud AI to process the details above.
      </label>
      <div className="row">
        <button onClick={() => void draft()} disabled={busy || !claim.narrative}>
          {busy ? "Working…" : "Draft a summary"}
        </button>
        {result && <RouteBadge route={result.route} />}
        {result?.fallback && <span className="hint">Cloud used because: {result.fallback.toLowerCase().replaceAll("_", " ")}</span>}
      </div>
      {error && <div className="note error" role="alert">{error}</div>}
      {shown && (
        <div className="panel">
          <div className="field">
            <label htmlFor="aisum">Summary (edit before you submit)</label>
            <textarea id="aisum" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {shown.missing_information.length > 0 && (
            <>
              <h3>Information that looks missing</h3>
              <ul className="plain">{shown.missing_information.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          {shown.follow_up_questions.length > 0 && (
            <>
              <h3>Questions to consider</h3>
              <ul className="plain">{shown.follow_up_questions.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          <p className="hint">{shown.safety_notice}</p>
          <button className="secondary" onClick={() => void save()}>Save this draft to my report</button>
        </div>
      )}
    </section>
  );
}
