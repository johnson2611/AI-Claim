import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";
import { RouteBadge } from "../components/RouteBadge";

const STEPS = [
  {
    title: "Tell us what happened",
    text: "Answer a few simple questions about the incident, the vehicle and whether anyone was hurt.",
  },
  {
    title: "Add photos and get help",
    text: "Upload photos of the damage. Optional AI help organises your details and points out anything missing.",
  },
  {
    title: "Submit and track",
    text: "Send your report in one click, get a reference number, and follow its progress.",
  },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const FEATURES = [
  {
    title: "Private by design",
    text: "AI help runs on your own device when it can. The cloud is used only if your device can't, and only with your permission.",
    icon: (
      <Icon>
        <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </Icon>
    ),
  },
  {
    title: "Always transparent",
    text: "Every AI result is labelled with where it ran, so you always know whether your details stayed on your device.",
    icon: (
      <Icon>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </Icon>
    ),
  },
  {
    title: "People make the decisions",
    text: "The AI drafts and flags missing details. It never decides fault, cost or approval. A claims officer reviews everything.",
    icon: (
      <Icon>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </Icon>
    ),
  },
  {
    title: "A clear record",
    text: "Each step is logged, from submission to review, so claims teams and customers can see what happened and when.",
    icon: (
      <Icon>
        <path d="M8 6h12M8 12h12M8 18h12" />
        <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </Icon>
    ),
  },
];

export function Landing() {
  const { role } = useAuth();
  const isOfficer = role === "OFFICER" || role === "ADMIN";

  return (
    <div className="lp">
      <section className="lp-hero" aria-labelledby="hero-title">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">Motor insurance claims</p>
          <h1 id="hero-title">
            Report a car accident in minutes, and know exactly what your insurer still needs.
          </h1>
          <p className="lp-lead">
            A guided report, a photo checklist and optional AI help that keeps your details on your
            device whenever it can.
          </p>
          <div className="row">
            {isOfficer ? (
              <Link className="btn lp-btn" to="/officer">
                Open the review queue
              </Link>
            ) : (
              <Link className="btn lp-btn" to="/claims/new">
                Start a report
              </Link>
            )}
            <Link className="btn secondary lp-btn" to="/lab">
              See how the AI runs
            </Link>
          </div>
        </div>

        <div className="lp-mock" aria-label="Example of a report summary">
          <div className="lp-mock-head">
            <strong>Report CLM-2026-EXAMPLE</strong>
            <span className="pill SUBMITTED">Submitted</span>
          </div>
          <ul className="lp-checks">
            <li className="done">Incident details</li>
            <li className="done">Damage photo added</li>
            <li className="done">Summary drafted by AI</li>
            <li>Reviewed by a claims officer</li>
          </ul>
          <div className="lp-mock-foot">
            <RouteBadge route="ON_DEVICE" />
            <span>Example</span>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-title" className="lp-section">
        <h2 id="how-title">How it works</h2>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="lp-num" aria-hidden="true">
                {i + 1}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why-title" className="lp-section">
        <h2 id="why-title">Built to be trusted</h2>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <article key={f.title} className="lp-feature">
              <span className="lp-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-band" aria-labelledby="privacy-title">
        <div>
          <h2 id="privacy-title">Your details stay with you when they can.</h2>
          <p>
            Modern browsers can run AI on your device. When yours can, that's what we use. When it
            can't, we ask before using the cloud, and we always show which one ran.
          </p>
        </div>
        <div className="lp-badges">
          <RouteBadge route="ON_DEVICE" />
          <RouteBadge route="IN_CLOUD" />
        </div>
      </section>

      <section className="lp-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Ready to report?</h2>
        <p>It takes a few minutes, and you can save your progress as you go.</p>
        <Link className="btn lp-btn" to={isOfficer ? "/officer" : "/claims/new"}>
          {isOfficer ? "Open the review queue" : "Start a report"}
        </Link>
      </section>

      <footer className="lp-footer">
        <p>
          <strong>Demo only.</strong> Use fictional details. This is not an emergency service. If
          anyone is hurt, call your local emergency number first.
        </p>
        <p>
          Built for #BuildHybridAI 2026 with Firebase AI Logic. <Link to="/lab">AI route lab</Link>
        </p>
      </footer>
    </div>
  );
}
