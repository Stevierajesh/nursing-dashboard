import ClinicalPriority from "../components/ClinicalPriority";
import { WORRY_LABELS } from "../lib/types";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { PatientDetail as Detail } from "../lib/types";
import PatientSimulations from "../components/PatientSimulations";
import PatientBedAssignment from "../components/PatientBedAssignment";
import NewsTrendChart from "../components/NewsTrendChart";
import {
  Card,
  ErrorNote,
  NewsBadge,
  REASON_LABELS,
  Spinner,
  Stat,
  StatusPill,
  timeAgo,
} from "../components/Primitives";

/**
 * Patient detail — the retrospective view.
 *
 * This is the screen that makes the case: the NEWS line with worry taps marked
 * on it, so you can see whether the nurse noticed before the score did.
 */
export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    let active = true;
    const load = () => api
      .get<Detail>(`/api/v1/patients/${patientId}`)
      .then((d) => { if (active) { setDetail(d); setError(null); } })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [patientId]);

  if (loading) return <Spinner label="Loading patient" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!detail) return null;

  const { patient, vitals, worry_signals, escalations, risk } = detail;

  // The headline: did worry precede the vitals crossing into the response band?
  const firstWorry = worry_signals
    .filter((w) => w.level > 0)
    .map((w) => new Date(w.created_at).getTime())
    .sort((a, b) => a - b)[0];
  const firstMediumVitals = vitals
    .filter((v) => (v.news_score ?? 0) >= 5)
    .map((v) => new Date(v.recorded_at).getTime())
    .sort((a, b) => a - b)[0];
  const leadMinutes =
    firstWorry && firstMediumVitals && firstMediumVitals > firstWorry
      ? Math.round((firstMediumVitals - firstWorry) / 60000)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/" className="text-sm text-ink-400 hover:underline">
          ← Board
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{patient.display_name}</h1>
          {patient.room && (
            <span className="text-ink-400">Room {patient.room}</span>
          )}
          {patient.bed && <span className="text-ink-400">Bed {patient.bed}</span>}
          <NewsBadge score={risk.latest_news} band={risk.news_band} />
        </div>
        <p className="mt-1 text-sm text-ink-400">
          {[patient.age ?? patient.age_band, patient.sex, patient.primary_language]
            .filter(Boolean)
            .join(" · ")}
          {" · admitted "}
          {new Date(patient.admitted_at).toLocaleDateString()}
        </p>
      </div>

      <ClinicalPriority news={detail.news_alert ?? { score: risk.latest_news, band: risk.news_band as "none" | "low" | "medium" | "high", single_red_parameters: [] }} escalation={escalations.find(escalation => ["open", "acknowledged", "auto_escalated"].includes(escalation.status))} />
      <PatientBedAssignment
        key={patient.id}
        patientId={patient.id}
        onMoved={updated => setDetail(current => current ? { ...current, patient: { ...current.patient, ...updated } } : current)}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Combined score"
          value={`${risk.score.toFixed(0)}/100`}
          hint="Vitals + trend + worry"
          tone="neutral"
        />
        <Stat
          label="NEWS trend"
          value={
            risk.trend_slope_per_hour > 0
              ? `+${risk.trend_slope_per_hour.toFixed(2)}`
              : risk.trend_slope_per_hour.toFixed(2)
          }
          unit="/hr"
          hint={
            risk.trend_slope_per_hour >= 0.25
              ? "Drifting upward"
              : risk.trend_slope_per_hour <= -0.25
                ? "Improving"
                : "Stable"
          }
          tone={risk.trend_slope_per_hour >= 0.25 ? "warning" : "neutral"}
        />
        <Stat
          label="Worry signals"
          value={worry_signals.filter((w) => w.level > 0).length}
          hint={
            `Peak: ${WORRY_LABELS[risk.worry_level as keyof typeof WORRY_LABELS].toLowerCase()}`
          }
        />
        {/* The money number, shown only when it is real. Fabricating a lead
            time when the data does not support one would be the single most
            damaging thing this screen could do. */}
        <Stat
          label="Nurse lead time"
          value={leadMinutes !== null ? leadMinutes : "—"}
          unit={leadMinutes !== null ? "min" : undefined}
          hint={
            leadMinutes !== null
              ? "Worry raised before NEWS reached 5"
              : "No lead to measure on this patient"
          }
          tone={leadMinutes !== null ? "good" : "neutral"}
        />
      </div>

      <Card>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">NEWS over time, with nurse worry</h2>
            <p className="text-xs text-ink-400">
              Amber and red dots are worry taps. Shaded bands are the NEWS
              medium (≥5) and high (≥7) response thresholds.
            </p>
          </div>
          <button
            onClick={() => setShowTable((s) => !s)}
            className="text-xs text-ink-400 underline hover:text-ink-200"
          >
            {showTable ? "Hide" : "Show"} data table
          </button>
        </div>

        <NewsTrendChart
          vitals={vitals}
          worrySignals={worry_signals}
          height={280}
        />

        {/* Table view: the accessibility fallback for the chart, and genuinely
            the faster way to read exact values. */}
        {showTable && (
          <div className="scroll-x mt-4">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-400">
                <tr className="border-b border-ink-700">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">NEWS</th>
                  <th className="py-2 pr-4 font-medium">RR</th>
                  <th className="py-2 pr-4 font-medium">SpO₂</th>
                  <th className="py-2 pr-4 font-medium">HR</th>
                  <th className="py-2 pr-4 font-medium">SBP</th>
                  <th className="py-2 font-medium">Temp</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {vitals
                  .slice()
                  .reverse()
                  .map((v) => (
                    <tr key={v.id} className="border-b border-ink-700/50">
                      <td className="py-1.5 pr-4 text-ink-400">
                        {new Date(v.recorded_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-1.5 pr-4 font-semibold">
                        {v.news_score}
                      </td>
                      <td className="py-1.5 pr-4">{v.resp_rate ?? "—"}</td>
                      <td className="py-1.5 pr-4">
                        {v.spo2 ?? "—"}
                        {v.supplemental_o2 && (
                          <span className="ml-1 text-xs text-warning">O₂</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-4">{v.heart_rate ?? "—"}</td>
                      <td className="py-1.5 pr-4">{v.systolic_bp ?? "—"}</td>
                      <td className="py-1.5">{v.temperature_c ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PatientSimulations key={patient.id} patient={patient} />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Worry timeline</h2>
          {worry_signals.length === 0 ? (
            <p className="text-sm text-ink-400">No worry signals recorded.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {worry_signals.map((w) => (
                <li
                  key={w.id}
                  className="border-l-2 pl-3"
                  style={{
                    borderColor:
                      w.level === 4
                        ? "var(--color-critical)"
                        : w.level > 0
                          ? "var(--color-warning)"
                          : "var(--color-ink-600)",
                  }}
                >
                  <div className="text-sm">
                    <span className="font-medium">
                      {w.nurse?.full_name ?? "A nurse"}
                    </span>
                    <span className="text-ink-200">
                      {" — "}
                      {WORRY_LABELS[w.level].toLowerCase()}
                    </span>
                  </div>
                  {w.reasons.length > 0 && (
                    <div className="text-xs text-ink-400">
                      {w.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}
                    </div>
                  )}
                  {w.note && (
                    <p className="mt-1 text-sm italic text-ink-200">
                      “{w.note}”
                    </p>
                  )}
                  <div className="mt-0.5 text-xs text-ink-500">
                    {timeAgo(w.created_at)}
                    {w.capture_ms !== null && (
                      <> · logged in {(w.capture_ms / 1000).toFixed(1)}s</>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Escalation history</h2>
          {escalations.length === 0 ? (
            <p className="text-sm text-ink-400">
              No escalations for this patient.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {escalations.map((e) => (
                <li key={e.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={e.status} />
                    <span className="text-ink-200">
                      {e.rule_label ?? e.rule}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-400">
                    Raised {timeAgo(e.triggered_at)}
                    {e.acknowledged_at && (
                      <>
                        {" · acknowledged in "}
                        {Math.round(
                          (new Date(e.acknowledged_at).getTime() -
                            new Date(e.triggered_at).getTime()) /
                            60000,
                        )}
                        m
                      </>
                    )}
                    {e.assessed_at && (
                      <>
                        {" · assessed in "}
                        {Math.round(
                          (new Date(e.assessed_at).getTime() -
                            new Date(e.triggered_at).getTime()) /
                            60000,
                        )}
                        m
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
