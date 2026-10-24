import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useEscalationFeed } from "../lib/realtime";
import type { EscalationRow } from "../lib/dashTypes";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  REASON_LABELS,
  Spinner,
  StatusPill,
  minutesSince,
  timeAgo,
} from "../components/Primitives";

/**
 * The response queue.
 *
 * Acknowledge and Assess are separate buttons on purpose. "I saw it" and
 * "I laid eyes on the patient" are different clinical events, and the gap
 * between them is exactly what the worry-to-response metric measures.
 */
export default function Escalations() {
  const { me } = useAuth();
  const [rows, setRows] = useState<EscalationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = showResolved
        ? "?status=open&status=acknowledged&status=auto_escalated&status=assessed&status=resolved"
        : "";
      const d = await api.get<{ escalations: EscalationRow[] }>(
        `/api/v1/dashboard/escalations${qs}`,
      );
      setRows(d.escalations);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load escalations");
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  useEscalationFeed(me?.organization?.id, () => void load());

  async function act(id: string, action: "acknowledge" | "assess") {
    setBusy(id + action);
    try {
      await api.post(`/api/v1/escalations/${id}/${action}`, {});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action}`);
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Spinner label="Loading escalations" />;

  return (
    <div className="flex flex-col gap-5">
      {/* Filters in one row above the content. */}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Response queue</h2>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="size-4 rounded border-ink-600 bg-ink-800"
          />
          Include resolved
        </label>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {rows.length === 0 ? (
        <Empty
          title="Nothing waiting"
          body="Escalations appear here the moment worry pairs with a vitals signal."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((e) => {
            const overdue =
              e.status === "open" && minutesSince(e.sla_deadline) > 0;
            const w = e.worry_signal;

            return (
              <li key={e.id}>
                <Card
                  className={
                    e.status === "auto_escalated" || overdue
                      ? "border-critical/50"
                      : e.status === "open"
                        ? "border-warning/50"
                        : ""
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/patients/${e.patient_id}`}
                          className="text-base font-semibold hover:underline"
                        >
                          {e.patient?.display_name ?? "Unknown patient"}
                        </Link>
                        {e.patient?.room && (
                          <span className="text-sm text-ink-400">
                            Room {e.patient.room}
                          </span>
                        )}
                        <StatusPill status={e.status} />
                      </div>

                      <div className="mt-1.5 text-sm text-ink-200">
                        {e.rule_label ?? e.rule}
                      </div>

                      {w && (
                        <div className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
                          <div className="text-xs uppercase tracking-wide text-ink-400">
                            What the nurse said
                          </div>
                          <div className="mt-1.5 text-sm">
                            <span className="font-medium">
                              {w.nurse?.full_name ?? "A nurse"}
                            </span>
                            <span className="text-ink-200">
                              {" was "}
                              {w.level === 2 ? "very worried" : "worried"}
                            </span>
                            {w.reasons.length > 0 && (
                              <span className="text-ink-200">
                                {" — "}
                                {w.reasons
                                  .map((r) => REASON_LABELS[r] ?? r)
                                  .join(", ")}
                              </span>
                            )}
                          </div>
                          {w.note && (
                            <p className="mt-1.5 text-sm italic text-ink-200">
                              “{w.note}”
                            </p>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                        <span>Raised {timeAgo(e.triggered_at)}</span>
                        {e.acknowledged_at ? (
                          <span className="text-ink-200">
                            Acknowledged by{" "}
                            {e.ack_by?.full_name ?? "someone"} in{" "}
                            {Math.round(
                              (new Date(e.acknowledged_at).getTime() -
                                new Date(e.triggered_at).getTime()) /
                                60000,
                            )}
                            m
                          </span>
                        ) : (
                          <span
                            className={
                              overdue
                                ? "font-semibold text-critical"
                                : "text-warning"
                            }
                          >
                            {overdue
                              ? `${Math.round(minutesSince(e.sla_deadline))}m past SLA`
                              : `${Math.max(0, Math.round(-minutesSince(e.sla_deadline)))}m left`}
                          </span>
                        )}
                        {e.assessed_at && (
                          <span className="text-ink-200">
                            Assessed by {e.assess_by?.full_name ?? "someone"} in{" "}
                            {Math.round(
                              (new Date(e.assessed_at).getTime() -
                                new Date(e.triggered_at).getTime()) /
                                60000,
                            )}
                            m
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      {!e.acknowledged_at && (
                        <Button
                          variant="ghost"
                          disabled={busy === e.id + "acknowledge"}
                          onClick={() => void act(e.id, "acknowledge")}
                        >
                          {busy === e.id + "acknowledge"
                            ? "…"
                            : "Acknowledge"}
                        </Button>
                      )}
                      {!e.assessed_at && (
                        <Button
                          disabled={busy === e.id + "assess"}
                          onClick={() => void act(e.id, "assess")}
                        >
                          {busy === e.id + "assess"
                            ? "…"
                            : "Mark assessed"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
