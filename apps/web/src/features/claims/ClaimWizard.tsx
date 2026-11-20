import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CONTACT_CHANNELS, INCIDENT_TYPES, type DraftClaimInput } from "@claims/shared";
import { useLocalDraft } from "../../hooks/useLocalDraft";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { api, ApiError } from "../../lib/api/client";
import type { ClaimDetail } from "../../lib/api/types";
import { AssistantPanel } from "../ai-assistant/AssistantPanel";
import { EvidenceUploader } from "../evidence/EvidenceUploader";

interface Form {
  policyReferenceMasked: string;
  incidentAt: string;
  incidentLocation: string;
  incidentType: string;
  vehicleDescription: string;
  injuriesReported: "" | "yes" | "no";
  otherParties: "" | "yes" | "no";
  contactChannel: string;
  narrative: string;
}

const EMPTY: Form = {
  policyReferenceMasked: "",
  incidentAt: "",
  incidentLocation: "",
  incidentType: "COLLISION",
  vehicleDescription: "",
  injuriesReported: "",
  otherParties: "",
  contactChannel: "EMAIL",
  narrative: "",
};

const STEPS = ["Incident", "Photos", "AI help", "Review and submit"] as const;

function fromClaim(c: ClaimDetail): Form {
  return {
    policyReferenceMasked: c.policyReferenceMasked ?? "",
    incidentAt: c.incidentAt ? c.incidentAt.slice(0, 16) : "",
    incidentLocation: c.incidentLocation ?? "",
    incidentType: c.incidentType ?? "COLLISION",
    vehicleDescription: c.vehicleDescription ?? "",
    injuriesReported: c.injuriesReported === null ? "" : c.injuriesReported ? "yes" : "no",
    otherParties: c.otherPartiesInvolved === null ? "" : c.otherPartiesInvolved ? "yes" : "no",
    contactChannel: c.contactChannel ?? "EMAIL",
    narrative: c.narrative ?? "",
  };
}

function toPayload(f: Form): DraftClaimInput {
  const out: Record<string, unknown> = {};
  if (f.policyReferenceMasked.trim().length >= 4) out.policyReferenceMasked = f.policyReferenceMasked.trim();
  if (f.incidentAt) out.incidentAt = new Date(f.incidentAt).toISOString();
  if (f.incidentLocation.trim().length >= 3) out.incidentLocation = f.incidentLocation.trim();
  out.incidentType = f.incidentType;
  if (f.vehicleDescription.trim()) out.vehicleDescription = f.vehicleDescription.trim();
  if (f.injuriesReported) out.injuriesReported = f.injuriesReported === "yes";
  if (f.otherParties) out.otherPartiesInvolved = f.otherParties === "yes";
  out.contactChannel = f.contactChannel;
  if (f.narrative.trim()) out.narrative = f.narrative.trim();
  return out as DraftClaimInput;
}

interface Props {
  claim: ClaimDetail | undefined;
  reload: (id: string) => Promise<void>;
}

export function ClaimWizard({ claim, reload }: Props) {
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const draftKey = `claim-draft:${claim?.id ?? "new"}`;
  const [form, setForm, clearLocal] = useLocalDraft<Form>(draftKey, claim ? fromClaim(claim) : EMPTY);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [agree, setAgree] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });

  /** Create or update the server draft. Returns the claim id, or undefined if it could not be saved. */
  async function saveToServer(): Promise<string | undefined> {
    setError(undefined);
    if (!online) {
      setError("You are offline. Your answers are saved on this device only. Nothing has been sent yet.");
      return undefined;
    }
    try {
      if (claim) {
        await api(`/api/claims/${claim.id}`, { method: "PATCH", body: toPayload(form) });
        return claim.id;
      }
      const created = await api<{ id: string }>("/api/claims", { method: "POST", body: toPayload(form) });
      clearLocal();
      navigate(`/claims/${created.id}`, { replace: true });
      return created.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your report.");
      return undefined;
    }
  }

  async function next(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const id = await saveToServer();
    if (id) {
      await reload(id);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
    setBusy(false);
  }

  async function submit() {
    if (!claim) return;
    setBusy(true);
    setError(undefined);
    try {
      if (!claim.consents.some((c) => c.purpose === "DATA_PROCESSING" && !c.withdrawnAt)) {
        await api(`/api/claims/${claim.id}/consents`, { method: "POST", body: { purpose: "DATA_PROCESSING" } });
      }
      await api(`/api/claims/${claim.id}/submit`, { method: "POST", body: {} });
      clearLocal();
      await reload(claim.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        const d = e.details as { missingFields?: string[]; missingEvidence?: string[] } | undefined;
        const missing = [...(d?.missingFields ?? []), ...(d?.missingEvidence ?? []).map((m) => `${m} photo`)];
        setError(`Not submitted yet. Still needed: ${missing.join(", ") || "consent"}.`);
      } else setError(e instanceof Error ? e.message : "Could not submit. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>{claim ? `Report ${claim.publicReference}` : "New motor claim report"}</h1>
      {claim?.status === "MORE_INFO_REQUIRED" && (
        <div className="note warn">The claims team asked for more information. Update your report and submit it again.</div>
      )}
      <ol className="stepper" aria-label="Progress">
        {STEPS.map((s, i) => <li key={s} aria-current={i === step ? "step" : undefined}>{s}</li>)}
      </ol>
      <p className="hint">Saved on this device as you type. A report is only sent when you submit it.</p>
      {error && <div className="note error" role="alert">{error}</div>}

      {step === 0 && (
        <form onSubmit={(e) => void next(e)} className="panel">
          <div className="split">
            <div className="field">
              <label htmlFor="pol">Policy reference</label>
              <input id="pol" value={form.policyReferenceMasked} onChange={(e) => set("policyReferenceMasked", e.target.value)} placeholder="e.g. ****1234" />
              <div className="hint">Enter only the last digits. Use a demo policy.</div>
            </div>
            <div className="field">
              <label htmlFor="when">Date and time</label>
              <input id="when" type="datetime-local" value={form.incidentAt} onChange={(e) => set("incidentAt", e.target.value)} />
            </div>
          </div>
          <div className="split">
            <div className="field">
              <label htmlFor="type">What happened?</label>
              <select id="type" value={form.incidentType} onChange={(e) => set("incidentType", e.target.value)}>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="veh">Vehicle</label>
              <input id="veh" value={form.vehicleDescription} onChange={(e) => set("vehicleDescription", e.target.value)} placeholder="Year, make, model, colour" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="loc">Where did it happen?</label>
            <input id="loc" value={form.incidentLocation} onChange={(e) => set("incidentLocation", e.target.value)} />
          </div>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600 }}>Was anyone injured?</legend>
            <label className="choice"><input type="radio" name="inj" checked={form.injuriesReported === "no"} onChange={() => set("injuriesReported", "no")} />No</label>
            <label className="choice"><input type="radio" name="inj" checked={form.injuriesReported === "yes"} onChange={() => set("injuriesReported", "yes")} />Yes</label>
            {form.injuriesReported === "yes" && <div className="note warn">If anyone needs medical help, call emergency services now. This tool is not an emergency service.</div>}
          </fieldset>
          <fieldset className="field" style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600 }}>Was another vehicle or person involved?</legend>
            <label className="choice"><input type="radio" name="other" checked={form.otherParties === "yes"} onChange={() => set("otherParties", "yes")} />Yes</label>
            <label className="choice"><input type="radio" name="other" checked={form.otherParties === "no"} onChange={() => set("otherParties", "no")} />No</label>
          </fieldset>
          <div className="field">
            <label htmlFor="narr">Describe what happened</label>
            <textarea id="narr" value={form.narrative} onChange={(e) => set("narrative", e.target.value)} />
            <div className="hint">Write in your own words. This original statement is kept exactly as you wrote it.</div>
          </div>
          <div className="field">
            <label htmlFor="chan">How should we contact you?</label>
            <select id="chan" value={form.contactChannel} onChange={(e) => set("contactChannel", e.target.value)}>
              {CONTACT_CHANNELS.map((c) => <option key={c} value={c}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <button disabled={busy}>{busy ? "Saving…" : "Save and continue"}</button>
        </form>
      )}

      {step === 1 && claim && (
        <div className="panel">
          <EvidenceUploader claim={claim} onChanged={() => void reload(claim.id)} />
          <div className="row"><button className="secondary" onClick={() => setStep(0)}>Back</button><button onClick={() => setStep(2)}>Continue</button></div>
        </div>
      )}

      {step === 2 && claim && (
        <div className="panel">
          <AssistantPanel claim={claim} onChanged={() => void reload(claim.id)} />
          <div className="row"><button className="secondary" onClick={() => setStep(1)}>Back</button><button onClick={() => setStep(3)}>Continue</button></div>
        </div>
      )}

      {step === 3 && claim && (
        <div className="panel">
          <h2>Check your report</h2>
          <p>Completeness: {claim.completeness.percent}%</p>
          {!claim.completeness.readyToSubmit && (
            <div className="note warn">
              Still needed: {[...claim.completeness.missingFields, ...claim.completeness.missingEvidence.map((m) => `${m} photo`)].join(", ")}.
            </div>
          )}
          <dl>
            <dt><strong>What happened</strong></dt><dd>{claim.narrative}</dd>
            <dt><strong>Where</strong></dt><dd>{claim.incidentLocation}</dd>
            <dt><strong>Photos attached</strong></dt><dd>{claim.evidence.length}</dd>
          </dl>
          <label className="choice">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I confirm these details are accurate, and I agree to my report and photos being processed to handle my claim.
          </label>
          <div className="row">
            <button className="secondary" onClick={() => setStep(2)}>Back</button>
            <button onClick={() => void submit()} disabled={busy || !agree || !claim.completeness.readyToSubmit || !online}>
              {busy ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
