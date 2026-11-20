import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/AuthProvider";

export function Layout({ children }: { children: ReactNode }) {
  const { signedIn, role, signOut } = useAuth();
  return (
    <>
      <header className="topbar">
        <div className="shell">
          <Link to="/" className="brand">
            Claims Assistant
          </Link>
          <nav aria-label="Main">
            {role === "CUSTOMER" && <Link to="/claims">My reports</Link>}
            {(role === "OFFICER" || role === "ADMIN") && <Link to="/officer">Review queue</Link>}
            <Link to="/lab">AI route lab</Link>
            {signedIn ? (
              <a
                href="#signout"
                onClick={(e) => {
                  e.preventDefault();
                  void signOut();
                }}
              >
                Sign out
              </a>
            ) : (
              <Link to="/signin">Sign in</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="shell">{children}</main>
    </>
  );
}
