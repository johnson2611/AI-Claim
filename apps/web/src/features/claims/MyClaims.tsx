import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ClaimStatus } from "@claims/shared";
import { StatusPill } from "../../components/StatusPill";
import { api } from "../../lib/api/client";

interface Row {
  id: string;
  publicReference: string;
  status: ClaimStatus;
  incidentType: string | null;
  updatedAt: string;
}

export function MyClaims() {
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api<Row[]>("/api/claims").then(setRows).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>My reports</h1>
        <Link className="btn" to="/claims/new">Start a new report</Link>
      </div>
      {error && <div className="note error" role="alert">{error}</div>}
      {rows?.length === 0 && <p>You have no reports yet. Start one when you are ready.</p>}
      {rows && rows.length > 0 && (
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Reference</th><th>Status</th><th>Type</th><th>Updated</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/claims/${r.id}`}>{r.publicReference}</Link></td>
                  <td><StatusPill status={r.status} /></td>
                  <td>{r.incidentType ?? ""}</td>
                  <td>{new Date(r.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
