import { useState } from "react";
import { EVIDENCE_LABEL_TEXT, SAFETY_NOTICE, type AiRoute, type AiSummary, type EvidenceLabel, type PhotoObservation } from "@claims/shared";
import { RouteBadge } from "../../components/RouteBadge";
import { api, apiBlob } from "../../lib/api/client";
import type { ClaimDetail } from "../../lib/api/types";
import { prepareImage } from "../../lib/imaging";
import { AiTaskError, generateCaseSummary } from "./caseSummary";
import { checkPhoto } from "./photoCheck";

interface Props {
  claim: ClaimDetail;
  onChanged: () => void;
}

const EMPTY: AiSummary = {
  incident_summary: "",
  customer_reported_facts: [],
  missing_information: [],
  follow_up_questions: [],
  evidence_checklist: [],
  uncertainties: [],
  safety_notice: SAFETY_NOTICE,
};

type Purpose = "CLOUD_AI_PROCESSING" | "IMAGE_ANALYSIS";

export function AssistantPanel({ claim, onChanged }: Props) {
  const granted = (p: Purpose) => claim.consents.some((c) => c.purpose === p && !c.withdrawnAt);
  const [cloudText, setCloudText] = useState(granted("CLOUD_AI_PROCESSING"));
  const [cloudPhotos, setCloudPhotos] = useState(granted("IMAGE_ANALYSIS"));
  const [draft, setDraft] = useState<AiSummary | undefined>(claim.aiDraft ?? undefined);
  const [text, setText] = useState(claim.aiDraft?.incident_summary ?? "");
  const [summaryRoute, setSummaryRoute] = useState<AiRoute>();
  const [photoRoutes, setPhotoRoutes] = useState<Record<string, AiRoute>>({});
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function consent(purpose: Purpose, on: boolean, set: (v: boolean) => void, already: boolean) {
    set(on);
    if (on && !already) {
      await api(`/api/claims/${claim.id}/consents`, { method: "POST", body: { purpose } }).catch(() => {
        set(false);
        setError("Could not record your choice. Cloud AI stays off.");
      });
    }
  }

  const report = (telemetry: unknown) =>
    void api(`/api/claims/${claim.id}/ai-analyses`, { method: "POST", body: telemetry }).catch(() => undefined);

  async function runSummary() {
    setBusy("Drafting the summary…");
    setError(undefined);
    setSaved(false);
    try {
      const { summary, telemetry } = await generateCaseSummary(
        {
          ...claim,
          evidenceLabels: claim.evidence.map((e) => e.label),
          photoNotes: draft?.photo_observations?.map((o) => o.visible_description),
        },
        cloudText,
      );
      setSummaryRoute(telemetry.route);
      setText(summary.incident_summary);
      setDraft({ ...summary, photo_observations: draft?.photo_observations });
      report(telemetry);
    } catch (e) {
      if (e instanceof AiTaskError) {
        report(e.telemetry);
        setError(
          cloudText
            ? "AI help could not finish. You can still complete the report yourself."
            : "On-device AI is not available in this browser. Allow cloud AI below, or continue without AI help.",
        );
      } else setError("AI help is unavailable right now. You can still complete the report yourself.");
    } finally {
      setBusy(undefined);
    }
  }

  async function runPhotos() {
    setError(undefined);
    setSaved(false);
    const found: PhotoObservation[] = [];
    const routes: Record<string, AiRoute> = {};
    let failed = 0;
    let firstReason = "";
    for (const [i, ev] of claim.evidence.entries()) {
      setBusy(`Checking photo ${i + 1} of ${claim.evidence.length}…`);
      try {
        const blob = await apiBlob(`/api/claims/${claim.id}/evidence/${ev.id}/content`);
        const image = await prepareImage(blob);
        const { observation, telemetry } = await checkPhoto({ evidenceId: ev.id, label: ev.label, image, cloudConsent: cloudPhotos });
        found.push(observation);
        routes[ev.id] = telemetry.route;
        report(telemetry);
      } catch (e) {
        failed += 1;
        if (e instanceof AiTaskError) report(e.telemetry);
        if (!firstReason) {
          firstReason =
            e instanceof AiTaskError && e.telemetry.status === "REJECTED_OUTPUT"
              ? "the AI's answer was not usable (wrong format, or it broke the safety rules), even after a retry"
              : e instanceof Error
                ? e.message
                : "unknown error";
        }
        console.warn("Photo check failed:", e instanceof Error ? e.message : e);
      }
    }
    setBusy(undefined);
    setPhotoRoutes(routes);
    if (found.length) setDraft({ ...(draft ?? EMPTY), photo_observations: found });
    if (failed) {
      setError(
        `${failed} photo(s) could not be checked: ${firstReason}. ` +
          (cloudPhotos
            ? "You can still submit your report."
            : "Nothing was sent anywhere. You can allow cloud AI for photos below, or continue without it."),
      );
    }
  }

  async function save() {
    if (!draft) return;
    await api(`/api/claims/${claim.id}/ai-draft`, { method: "PUT", body: { ...draft, incident_summary: text } });
    setSaved(true);
    onChanged();
  }

  const working = !!busy;
  return (
    <section>
      <h2>AI help (optional)</h2>
      <div className="note ai">
        AI-generated draft. Human review required. It will not decide your claim.
      </div>

      <h3>1. Check my photos</h3>
      <p className="hint">
        The AI describes what is visible in each photo and whether it looks clear. Photos are resized first, which also removes
        hidden location data. If a number plate is clearly legible, the AI may copy it, but it can misread characters, so please check it. By default photos are analysed on this device and are not sent anywhere.
      </p>
      <label className="choice">
        <input type="checkbox" checked={cloudPhotos} onChange={(e) => void consent("IMAGE_ANALYSIS", e.target.checked, setCloudPhotos, granted("IMAGE_ANALYSIS"))} />
        If my device cannot analyse photos, allow cloud AI to look at my photos.
      </label>
      <div className="row">
        <button onClick={() => void runPhotos()} disabled={working || claim.evidence.length === 0}>Check my photos</button>
        {busy && <span role="status">{busy}</span>}
      </div>
      {draft?.photo_observations && draft.photo_observations.length > 0 && (
        <div className="panel">
          <h3>What the AI sees (unverified)</h3>
          <ul className="plain">
            {draft.photo_observations.map((o) => (
              <li key={o.evidence_id} style={{ marginBottom: "0.6rem" }}>
                <strong>{EVIDENCE_LABEL_TEXT[o.label as EvidenceLabel] ?? o.label}:</strong> {o.visible_description}{" "}
                <span className="hint">
                  (photo looks {o.photo_quality}; matches your label: {o.matches_label})
                </span>{" "}
                {photoRoutes[o.evidence_id] && <RouteBadge route={photoRoutes[o.evidence_id]!} />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>2. Draft a summary</h3>
      <p className="hint">
        Sent to the AI: incident type, time, location, vehicle, your answers and your description (phone numbers and emails removed), plus
        the photo notes above. Not sent: policy reference, contact details, the photos themselves.
      </p>
      <label className="choice">
        <input type="checkbox" checked={cloudText} onChange={(e) => void consent("CLOUD_AI_PROCESSING", e.target.checked, setCloudText, granted("CLOUD_AI_PROCESSING"))} />
        If my device cannot run the AI locally, allow cloud AI to process the details above.
      </label>
      <div className="row">
        <button onClick={() => void runSummary()} disabled={working || !claim.narrative}>Draft a summary</button>
        {summaryRoute && <RouteBadge route={summaryRoute} />}
      </div>

      {error && <div className="note error" role="alert">{error}</div>}

      {draft && draft.incident_summary !== "" || text ? (
        <div className="panel">
          <div className="field">
            <label htmlFor="aisum">Summary (edit before you submit)</label>
            <textarea id="aisum" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {draft && draft.missing_information.length > 0 && (
            <>
              <h3>Information that looks missing</h3>
              <ul className="plain">{draft.missing_information.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          {draft && draft.follow_up_questions.length > 0 && (
            <>
              <h3>Questions to consider</h3>
              <ul className="plain">{draft.follow_up_questions.map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          <p className="hint">{SAFETY_NOTICE}</p>
        </div>
      ) : null}

      {draft && (
        <div className="row">
          <button className="secondary" onClick={() => void save()} disabled={working}>Save this to my report</button>
          {saved && <span role="status">Saved.</span>}
        </div>
      )}
    </section>
  );
}
