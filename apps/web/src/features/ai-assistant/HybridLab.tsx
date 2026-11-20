import { useEffect, useState } from "react";
import type { AiRoute } from "@claims/shared";
import { RouteBadge } from "../../components/RouteBadge";
import {
  HybridTaskError,
  onDeviceAvailability,
  prepareOnDeviceModel,
  runHybridTask,
  type InferencePolicy,
  type OnDeviceAvailability,
} from "../../lib/firebase/ai";

interface Run {
  at: string;
  policy: InferencePolicy;
  route: AiRoute | "ERROR";
  latencyMs: number;
  reason?: string;
}

const POLICIES: { value: InferencePolicy; label: string }[] = [
  { value: "PREFER_ON_DEVICE", label: "Prefer on-device (falls back to cloud)" },
  { value: "ONLY_ON_DEVICE", label: "Only on-device (errors if unavailable)" },
  { value: "PREFER_IN_CLOUD", label: "Prefer cloud" },
  { value: "ONLY_IN_CLOUD", label: "Only cloud (use this to demo the cloud path)" },
];

/** Day-4 proof of concept and live demo tool: shows the real route for every call. No claim data is used here. */
export function HybridLab() {
  const [availability, setAvailability] = useState<OnDeviceAvailability>();
  const [progress, setProgress] = useState<number>();
  const [policy, setPolicy] = useState<InferencePolicy>("PREFER_ON_DEVICE");
  const [prompt, setPrompt] = useState("In two sentences, explain what a first notice of loss is in motor insurance.");
  const [output, setOutput] = useState("");
  const [last, setLast] = useState<AiRoute>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    void onDeviceAvailability().then(setAvailability);
  }, []);

  async function prepare() {
    setError(undefined);
    try {
      await prepareOnDeviceModel(setProgress);
      setAvailability(await onDeviceAvailability());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare the on-device model.");
    }
  }

  async function run() {
    setBusy(true);
    setError(undefined);
    const at = new Date().toLocaleTimeString();
    try {
      const r = await runHybridTask({ policy, systemInstruction: "Answer briefly and neutrally.", prompt, parse: (t) => t });
      setOutput(r.data);
      setLast(r.route);
      setRuns((prev) => [{ at, policy, route: r.route, latencyMs: r.latencyMs, reason: r.fallbackReason }, ...prev]);
    } catch (e) {
      const ms = e instanceof HybridTaskError ? e.latencyMs : 0;
      setError(e instanceof Error ? e.message : "Request failed");
      setRuns((prev) => [{ at, policy, route: "ERROR", latencyMs: ms }, ...prev]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>AI route lab</h1>
      <p>Test which route Firebase AI Logic uses. Use only generic text here, never real claim details.</p>
      <div className="panel">
        <p><strong>On-device model on this browser:</strong> {availability ?? "checking…"}</p>
        {(availability === "downloadable" || availability === "downloading") && (
          <div className="row">
            <button className="secondary" onClick={() => void prepare()}>Prepare on-device model</button>
            {progress !== undefined && <span>{progress}%</span>}
          </div>
        )}
      </div>
      <div className="panel">
        <div className="field">
          <label htmlFor="policy">Inference mode</label>
          <select id="policy" value={policy} onChange={(e) => setPolicy(e.target.value as InferencePolicy)}>
            {POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="prompt">Prompt</label>
          <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>
        <div className="row">
          <button onClick={() => void run()} disabled={busy}>{busy ? "Running…" : "Run"}</button>
          {last && <RouteBadge route={last} />}
        </div>
        {error && <div className="note error" role="alert">{error}</div>}
        {output && <div className="note">{output}</div>}
      </div>
      {runs.length > 0 && (
        <div className="panel table-wrap">
          <h3>Runs this session (no prompts or outputs stored)</h3>
          <table>
            <thead><tr><th>Time</th><th>Mode</th><th>Route</th><th>Latency</th><th>Fallback reason</th></tr></thead>
            <tbody>
              {runs.map((r, i) => (
                <tr key={i}><td>{r.at}</td><td>{r.policy}</td><td>{r.route}</td><td>{r.latencyMs} ms</td><td>{r.reason ?? ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
