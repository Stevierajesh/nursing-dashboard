import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { supabaseConfigured } from "./lib/supabase";
import { Card, ErrorNote, Spinner } from "./components/Primitives";
import ConfigError from "./components/ConfigError";
import Login from "./screens/Login";
import Board from "./screens/Board";
import Escalations from "./screens/Escalations";
import PatientDetail from "./screens/PatientDetail";
import Metrics from "./screens/Metrics";
import Equity from "./screens/Equity";
import Admin from "./screens/Admin";

const NAV = [
  { to: "/", label: "Board", end: true },
  { to: "/escalations", label: "Response queue" },
  { to: "/metrics", label: "Response time" },
  { to: "/equity", label: "Equity audit" },
  { to: "/admin", label: "Admin" },
];

export default function App() {
  const { session, me, loading, error, signOut } = useAuth();

  if (!supabaseConfigured) return <ConfigError />;
  if (loading) return <Spinner label="Starting up" />;
  if (!session) return <Login />;

  if (!me) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col gap-4">
          <ErrorNote>{error ?? "Could not load your profile."}</ErrorNote>
          <button onClick={signOut} className="text-sm text-ink-400 underline">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // This console is for charge nurses and admins. Anyone else gets pointed at
  // the right app rather than a blank 403 -- and gets told what they actually
  // are: a prescriber used to be greeted as a nurse and sent off to raise
  // concerns, which is neither their role nor their job.
  if (me.user.role === "nurse" || me.user.role === "prescriber") {
    const isPrescriber = me.user.role === "prescriber";
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <h1 className="text-lg font-semibold">This is the charge console</h1>
          <p className="mt-2 text-sm text-ink-200">
            {isPrescriber
              ? "You're signed in as a doctor. Approval requests reach you in the Salus app — open it to review what's waiting."
              : "You're signed in as a nurse. The patient-facing app is where you raise concerns — open it on your phone."}
          </p>
          <button
            onClick={signOut}
            className="mt-4 text-sm text-ink-400 underline"
          >
            Sign out
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <div className="font-bold">Nurse Worry Layer</div>

          {/* Charge nurses see the Admin tab too -- they need the roster and
              assignments to run a shift. Write actions inside it are
              admin-gated server-side. */}
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-ink-700 text-white"
                      : "text-ink-400 hover:bg-ink-800 hover:text-ink-200"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-ink-400">
              {me.user.full_name}
              <span className="text-ink-500">
                {" · "}
                {me.user.role === "admin" ? "Admin" : "Charge nurse"}
              </span>
            </span>
            <button onClick={signOut} className="text-ink-400 hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6">
        <Routes>
          <Route path="/" element={<Board />} />
          <Route path="/escalations" element={<Escalations />} />
          <Route path="/patients/:patientId" element={<PatientDetail />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/equity" element={<Equity />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
