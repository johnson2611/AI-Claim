import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

export function SignIn() {
  const { signIn, signedIn, role } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // The role arrives from the server just after sign-in, so send people to the right home page once it is known.
  useEffect(() => {
    if (signedIn && role) navigate(role === "CUSTOMER" ? "/claims" : "/officer", { replace: true });
  }, [signedIn, role, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email, password);
    } catch {
      setError("We could not sign you in. Check your email and password.");
      setBusy(false);
    }
  }

  return (
    <section style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <p className="hint">Demo accounts only. Do not use a real insurance login.</p>
      <form onSubmit={onSubmit} className="panel">
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="note error" role="alert">{error}</div>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </section>
  );
}
