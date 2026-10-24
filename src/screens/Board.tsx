import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { chime, useEscalationFeed } from "../lib/realtime";
import type { BoardPatient, Summary } from "../lib/dashTypes";
import {
  Empty,
  ErrorNote,
  NewsBadge,
  REASON_LABELS,
  Spinner,
  Stat,
  StatusPill,
  WorryBadge,
  minutesSince,
  timeAgo,
} from "../components/Primitives";

/**
 * The ranked board.
 *
 * Ordering comes from the API and is not pure risk score: an un-responded
 * escalation outranks everything, because the board's job is to make ignored
 * worry impossible to scroll past.
 */
export default function Board() {
  const { me } = useAuth();
  const [patients, setPatients] = useState<BoardPatient[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api.get<{ patients: BoardPatient[] }>("/api/v1/dashboard/patients"),
        api.get<Summary>("/api/v1/dashboard/summary"),
      ]);
      setPatients(p.patients);
      setSummary(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Fallback refresh. Realtime is the primary path; this covers a dropped
    // websocket without making the board go stale on a ward station that
    // nobody is touching.
    const timer = setInterval(() => void load(), 45_000);
    return () => clearInterval(timer);
  }, [load]);

  // Realtime: a worry tap on a phone should land here in under a second.
  const seen = useRef<Set<string>>(new Set());
  useEscalationFeed(me?.organization?.id, (event) => {
    if (event.table === "escalations" && event.type === "INSERT") {
      const id = String(event.row.id);
      if (!seen.current.has(id)) {
        seen.current.add(id);
        chime();
        const pid = String(event.row.patient_id);
        setFlashIds((prev) => new Set(prev).add(pid));
        setTimeout(
          () =>
            setFlashIds((prev) => {
              const next = new Set(prev);
              next.delete(pid);
              return next;
            }),
          7000,
        );
      }
    }
    void load();
  });

  if (loading) return <Spinner label="Loading the board" />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Active patients"
          value={summary?.active_patients ?? 0}
          hint={me?.unit?.name ?? "All units"}
        />
        <Stat
          label="Open escalations"
          value={summary?.open_escalations ?? 0}
          tone={
            (summary?.open_escalations ?? 0) > 0 ? "warning" : "good"
          }
          hint="Awaiting acknowledgement or assessment"
        />
        <Stat
          label="SLA breaches"
          value={summary?.sla_breaches ?? 0}
          tone={(summary?.sla_breaches ?? 0) > 0 ? "critical" : "good"}
          hint={`No response within ${me?.organization?.worry_sla_minutes ?? 20} min`}
        />
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {patients.length === 0 ? (
        <Empty
          title="No active patients"
          body="Add patients from the Admin tab to populate the board."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {patients.map((p) => {
            const esc = p.open_escalation;
            const flashing = flashIds.has(p.id);
            const overdue =
              esc && esc.status === "open"
                ? minutesSince(esc.sla_deadline) > 0
                : false;

            return (
              <li key={p.id}>
                <Link
                  to={`/patients/${p.id}`}
                  className={`block rounded-xl border bg-ink-800 p-4 transition hover:border-ink-400 ${
                    esc
                      ? esc.status === "auto_escalated" || overdue
                        ? "border-critical/50"
                        : "border-warning/50"
                      : "border-ink-700"
                  } ${flashing ? "escalation-new" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">
                          {p.display_name}
                        </span>
                        {p.room && (
                          <span className="text-sm text-ink-400">
                            Room {p.room}
                          </span>
                        )}
                      </div>

                      {/* The nurse's own words, carried to the responder. This
                          is what makes the page actionable. */}
                      {p.latest_worry && p.latest_worry.level > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                          <WorryBadge level={p.latest_worry.level} />
                          <span className="text-ink-200">
                            {p.latest_worry.nurse?.full_name ?? "A nurse"}
                          </span>
                          {p.latest_worry.reasons.length > 0 && (
                            <span className="text-ink-400">
                              ·{" "}
                              {p.latest_worry.reasons
                                .map((r) => REASON_LABELS[r] ?? r)
                                .join(", ")}
                            </span>
                          )}
                          <span className="text-ink-500">
                            · {timeAgo(p.latest_worry.created_at)}
                          </span>
                        </div>
                      )}
                      {p.latest_worry?.note && (
                        <p className="mt-1.5 text-sm italic text-ink-200">
                          “{p.latest_worry.note}”
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <NewsBadge score={p.latest_news} band={p.news_band} />
                      {esc && <StatusPill status={esc.status} />}
                    </div>
                  </div>

                  {esc && (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-700 pt-3 text-xs">
                      <span className="text-ink-200">
                        {p.escalation_rule_label ?? esc.rule}
                      </span>
                      <span className="text-ink-400">
                        Raised {timeAgo(esc.triggered_at)}
                      </span>
                      {esc.status === "open" && (
                        <span
                          className={
                            overdue
                              ? "font-semibold text-critical"
                              : "text-warning"
                          }
                        >
                          {overdue
                            ? `${Math.round(minutesSince(esc.sla_deadline))}m past SLA`
                            : `${Math.max(0, Math.round(-minutesSince(esc.sla_deadline)))}m left to respond`}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3">
                    <RiskBar patient={p} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Stacked risk bar: worry / vitals / trend contribution.
 *
 * Three fixed categorical slots, assigned by component and never cycled, with
 * a 2px surface gap between segments so the boundaries read without a border.
 */
function RiskBar({ patient }: { patient: BoardPatient }) {
  const c = patient.risk_components;
  const total = Math.min(patient.risk_score, 100);

  return (
    <>
      <div className="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full bg-ink-700">
        {c ? (
          <>
            <span
              className="h-full bg-series-1"
              style={{ width: `${c.vitals}%` }}
              title={`Vitals ${c.vitals.toFixed(1)}`}
            />
            <span
              className="h-full bg-series-2"
              style={{ width: `${c.trend}%` }}
              title={`Trend ${c.trend.toFixed(1)}`}
            />
            <span
              className="h-full bg-series-3"
              style={{ width: `${c.worry}%` }}
              title={`Worry ${c.worry.toFixed(1)}`}
            />
          </>
        ) : (
          <span className="h-full bg-ink-600" style={{ width: `${total}%` }} />
        )}
      </div>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-400">
        risk {total.toFixed(0)}
      </span>
    </>
  );
}
