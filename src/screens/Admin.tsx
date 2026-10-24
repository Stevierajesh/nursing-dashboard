import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Role } from "../lib/types";
import {
  Button,
  Card,
  ErrorNote,
  Spinner,
} from "../components/Primitives";

interface OrgUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  unit_id: string | null;
}
interface Unit {
  id: string;
  name: string;
}
interface Assignment {
  id: string;
  nurse: { id: string; full_name: string } | null;
  patient: { id: string; display_name: string; room: string | null } | null;
}

const ROLES: Role[] = ["admin", "charge_nurse", "nurse"];
const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  charge_nurse: "Charge nurse",
  nurse: "Nurse",
};

export default function Admin() {
  const { me } = useAuth();
  const isAdmin = me?.user.role === "admin";

  const [users, setUsers] = useState<OrgUser[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sla, setSla] = useState<number>(
    me?.organization?.worry_sla_minutes ?? 20,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, un, a] = await Promise.all([
        api.get<{ users: OrgUser[] }>("/api/v1/admin/users"),
        api.get<{ units: Unit[] }>("/api/v1/admin/units"),
        api.get<{ assignments: Assignment[] }>("/api/v1/admin/assignments"),
      ]);
      setUsers(u.users);
      setUnits(un.units);
      setAssignments(a.assignments);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRole(userId: string, role: Role) {
    try {
      await api.patch(`/api/v1/admin/users/${userId}`, { role });
      setNotice("Role updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update role");
    }
  }

  async function saveSla() {
    try {
      await api.patch("/api/v1/admin/org", { worry_sla_minutes: sla });
      setNotice(
        `SLA set to ${sla} minutes. Worry with no reassessment inside that window now auto-escalates.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the SLA");
    }
  }

  if (loading) return <Spinner label="Loading settings" />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Administration</h1>
        <p className="mt-1 text-sm text-ink-400">
          {me?.organization?.name}
        </p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {notice && (
        <div className="rounded-lg border border-good/30 bg-good/10 p-3 text-sm text-good">
          {notice}
        </div>
      )}

      {isAdmin && (
        <Card>
          <h2 className="font-semibold">Escalation SLA</h2>
          <p className="mt-1 text-sm text-ink-400">
            How long an escalation may sit without a response before the system
            auto-escalates it. Lower this to 1 minute to demo the closed loop.
          </p>
          <div className="mt-3 flex items-end gap-3">
            <div>
              <label
                htmlFor="sla"
                className="mb-1 block text-xs uppercase tracking-wide text-ink-400"
              >
                Minutes
              </label>
              <input
                id="sla"
                type="number"
                min={1}
                max={240}
                value={sla}
                onChange={(e) => setSla(Number(e.target.value))}
                className="w-24 rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm tabular-nums focus:border-ink-400 focus:outline-none"
              />
            </div>
            <Button onClick={() => void saveSla()}>Save</Button>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-semibold">
          People <span className="text-ink-400">({users.length})</span>
        </h2>
        <div className="scroll-x">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr className="border-b border-ink-700">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Unit</th>
                <th className="py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-700/50">
                  <td className="py-2 pr-4">{u.full_name}</td>
                  <td className="py-2 pr-4 text-ink-400">{u.email}</td>
                  <td className="py-2 pr-4 text-ink-400">
                    {units.find((un) => un.id === u.unit_id)?.name ?? "—"}
                  </td>
                  <td className="py-2">
                    {isAdmin ? (
                      <select
                        value={u.role}
                        onChange={(e) =>
                          void changeRole(u.id, e.target.value as Role)
                        }
                        /* An admin demoting themselves would lock the org out
                           of its own settings. */
                        disabled={u.id === me?.user.id}
                        className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ROLE_LABELS[u.role]
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">
          Active shift assignments{" "}
          <span className="text-ink-400">({assignments.length})</span>
        </h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-ink-400">
            No active assignments. Nurses only see patients assigned to them.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {assignments.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-ink-700 bg-ink-900 p-2.5 text-sm"
              >
                <span className="font-medium">
                  {a.nurse?.full_name ?? "Unassigned"}
                </span>
                <span className="text-ink-400"> → </span>
                <span>{a.patient?.display_name ?? "Unknown"}</span>
                {a.patient?.room && (
                  <span className="text-ink-400"> (rm {a.patient.room})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
