import { useEffect, useState } from "react";
import { apiBlob } from "../lib/api/client";

/** Evidence is private: each image is fetched with the user's sign-in and shown from memory. */
export function EvidenceThumb({ claimId, evidenceId, label }: { claimId: string; evidenceId: string; label: string }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let objectUrl: string | undefined;
    let alive = true;
    apiBlob(`/api/claims/${claimId}/evidence/${evidenceId}/content`)
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [claimId, evidenceId]);
  return (
    <figure>
      {url ? <img src={url} alt={label} /> : <img alt="" />}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
