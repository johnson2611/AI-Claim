import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusPill } from "../../components/StatusPill";
import { api } from "../../lib/api/client";
import type { QueueItem } from "../../lib/api/types";

export function OfficerQueue() {
  const [items, setItems] = useState<QueueItem[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api<{ items: QueueItem[] }>("/api/officer/claims")
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section>
      <h1>Review queue</h1>
      {error && <div className="note error" role="alert">{error}</div>}
      {items?.length === 0 && <p>No submitted reports yet.</p>}
      {items && items.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Reference</th><th>Status</th><th>Type</th><th>Submitted</th><th>Completeness</th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/officer/claims/${c.id}`}>{c.publicReference}</Link></td>
                  <td><StatusPill status={c.status} /></td>
                  <td>{c.incidentType ?? ""}</td>
                  <td>{c.submittedAt ? new Date(c.submittedAt).toLocaleString() : ""}</td>
                  <td>
                    <div className="meter" aria-label={`${c.completenessPercent}% complete`}><span style={{ width: `${c.completenessPercent}%` }} /></div>
                    {c.completenessPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
