import { useState, type ChangeEvent } from "react";
import {
  ALLOWED_IMAGE_TYPES,
  EVIDENCE_LABEL_TEXT,
  EVIDENCE_LABELS,
  MAX_IMAGE_BYTES,
  type EvidenceLabel,
} from "@claims/shared";
import { EvidenceThumb } from "../../components/EvidenceThumb";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { api, apiUpload, ApiError } from "../../lib/api/client";
import type { ClaimDetail } from "../../lib/api/types";
import { sha256Hex } from "../../lib/validation/sha256";

export function EvidenceUploader({ claim, onChanged }: { claim: ClaimDetail; onChanged: () => void }) {
  const online = useOnlineStatus();
  const [label, setLabel] = useState<EvidenceLabel>("DAMAGE");
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(undefined);

    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setError("Only JPEG or PNG images are accepted.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`That image is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB. Choose a smaller one.`);
      return;
    }

    try {
      setStatus("Preparing upload…");
      const checksum = await sha256Hex(file);
      const { uploadPath } = await api<{ evidenceId: string; uploadPath: string }>(
        `/api/claims/${claim.id}/evidence`,
        { method: "POST", body: { fileName: file.name, contentType: file.type, sizeBytes: file.size, label, checksum } },
      );
      setStatus("Uploading and checking the file…");
      await apiUpload(uploadPath, file);
      setStatus(undefined);
      onChanged();
    } catch (err) {
      // An upload counts only after the server accepts it. Anything else is shown as not uploaded.
      setStatus(undefined);
      setError(err instanceof ApiError ? err.message : "The upload did not finish, so this photo is not attached. Try again.");
    }
  }

  return (
    <section>
      <h2>Add photos</h2>
      <div className="note warn">Never put yourself in danger to take photos. If anyone is hurt, call emergency services first.</div>
      {!online && <div className="note error" role="alert">You are offline. Uploads will not start until you reconnect. Nothing has been sent.</div>}
      <div className="split">
        <div className="field">
          <label htmlFor="label">What does this photo show?</label>
          <select id="label" value={label} onChange={(e) => setLabel(e.target.value as EvidenceLabel)}>
            {EVIDENCE_LABELS.map((l) => <option key={l} value={l}>{EVIDENCE_LABEL_TEXT[l]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="file">Photo (JPEG or PNG, up to {MAX_IMAGE_BYTES / 1024 / 1024} MB)</label>
          <input id="file" type="file" accept="image/jpeg,image/png" onChange={(e) => void onFile(e)} disabled={!online || !!status} />
        </div>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <div className="note error" role="alert">{error}</div>}
      <h3>Checklist</h3>
      <p className="hint">
        Needed: {claim.completeness.missingEvidence.length ? claim.completeness.missingEvidence.join(", ") : "all required photos added"}.
        {claim.completeness.recommendedEvidence.length > 0 && ` Helpful: ${claim.completeness.recommendedEvidence.join(", ")}.`}
      </p>
      <div className="thumbs">
        {claim.evidence.map((e) => (
          <EvidenceThumb key={e.id} claimId={claim.id} evidenceId={e.id} label={EVIDENCE_LABEL_TEXT[e.label as EvidenceLabel] ?? e.label} />
        ))}
      </div>
    </section>
  );
}
