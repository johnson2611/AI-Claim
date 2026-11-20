import { Navigate, Route, Routes } from "react-router-dom";
import type { Role } from "@claims/shared";
import { Layout } from "../components/Layout";
import { HybridLab } from "../features/ai-assistant/HybridLab";
import { ClaimPage } from "../features/claims/ClaimPage";
import { MyClaims } from "../features/claims/MyClaims";
import { OfficerCase } from "../features/officer-review/OfficerCase";
import { OfficerQueue } from "../features/officer-review/OfficerQueue";
import { Landing } from "../routes/Landing";
import { SignIn } from "../routes/SignIn";
import { useAuth } from "./AuthProvider";

function Protected({ roles, children }: { roles: Role[]; children: JSX.Element }) {
  const { ready, signedIn, role } = useAuth();
  if (!ready) return <p className="shell">Loading…</p>;
  if (!signedIn) return <Navigate to="/signin" replace />;
  if (!role || !roles.includes(role)) {
    return (
      <div className="shell">
        <div className="note error">You do not have access to this page.</div>
      </div>
    );
  }
  return children;
}

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/lab" element={<HybridLab />} />
        <Route path="/claims" element={<Protected roles={["CUSTOMER"]}><MyClaims /></Protected>} />
        <Route path="/claims/new" element={<Protected roles={["CUSTOMER"]}><ClaimPage /></Protected>} />
        <Route path="/claims/:claimId" element={<Protected roles={["CUSTOMER"]}><ClaimPage /></Protected>} />
        <Route path="/officer" element={<Protected roles={["OFFICER", "ADMIN"]}><OfficerQueue /></Protected>} />
        <Route path="/officer/claims/:claimId" element={<Protected roles={["OFFICER", "ADMIN"]}><OfficerCase /></Protected>} />
        <Route path="*" element={<div className="shell"><h1>Page not found</h1></div>} />
      </Routes>
    </Layout>
  );
}
