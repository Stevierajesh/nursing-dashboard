import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { EquityResponse } from "../lib/dashTypes";
import { EquityChart } from "../components/MetricCharts";
import { Card, ErrorNote, Spinner } from "../components/Primitives";

const DIMENSION_LABELS: Record<string, string> = {
  race: "Race",
  language: "Primary language",
  age_band: "Age band",
  sex: "Sex",
};

/**
 * Equity audit.
 *
 * Answers "is it fair?" with data rather than assurance. Two distinct
 * questions, and both matter:
 *
 *   1. Do some patient groups wait longer for a response? (this screen)
 *   2. Do nurses raise worry less often for some groups in the first place?
 *
 * The second is the subtler failure and the harder one to fix, so the screen
 * says so explicitly rather than implying the first question is the whole
 * audit.
 */
export default function Equity() {
  const [data, setData] = useState<EquityResponse | null>(null);
  const [dimension, setDimension] = useState("language");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<EquityResponse>("/api/v1/metrics/equity")
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const buckets = useMemo(
    () =>
      (data?.response_time_audit ?? []).filter(
        (b) => b.dimension === dimension,
      ),
    [data, dimension],
  );

  // Cohort mean weighted by escalation count, so a tiny bucket with a wild
  // average does not shift the comparison line everyone is judged against.
  const cohortMean = useMemo(() => {
    const all = data?.response_time_audit ?? [];
    const sameDim = all.filter((b) => b.dimension === dimension);
    const totalN = sameDim.reduce((s, b) => s + b.escalation_count, 0);
    if (totalN === 0) return null;
    const weighted = sameDim.reduce(
      (s, b) => s + (b.avg_ack_minutes ?? 0) * b.escalation_count,
      0,
    );
    return weighted / totalN;
  }, [data, dimension]);

  if (loading) return <Spinner label="Running the audit" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const flagged = buckets.filter(
    (b) =>
      !b.low_confidence &&
      cohortMean !== null &&
      (b.avg_ack_minutes ?? 0) > cohortMean * 1.3,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Equity audit</h1>
        <p className="mt-1 text-sm text-ink-400">
          Whether the system responds equally to worry raised about different
          patients.
        </p>
      </div>

      {flagged.length > 0 && (
        <div className="rounded-xl border border-critical/40 bg-critical/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-critical">
            <span aria-hidden>⚠</span>
            Disparity detected
          </div>
          <p className="mt-1.5 text-sm text-ink-200">
            {flagged
              .map(
                (b) =>
                  `${b.value} patients wait ${b.avg_ack_minutes}m on average`,
              )
              .join("; ")}
            , against a cohort mean of {cohortMean?.toFixed(1)}m. Worth raising
            at the next safety huddle.
          </p>
        </div>
      )}

      <div
        className="flex flex-wrap gap-1 rounded-lg border border-ink-600 bg-ink-800 p-1"
        role="group"
        aria-label="Audit dimension"
      >
        {data.dimensions.map((d) => (
          <button
            key={d}
            onClick={() => setDimension(d)}
            aria-pressed={dimension === d}
            className={`min-h-8 rounded px-3 text-sm font-medium transition ${
              dimension === d
                ? "bg-white text-ink-900"
                : "text-ink-200 hover:bg-ink-700"
            }`}
          >
            {DIMENSION_LABELS[d] ?? d}
          </button>
        ))}
      </div>

      <Card>
        <h2 className="mb-1 font-semibold">
          Mean time to respond by {DIMENSION_LABELS[dimension] ?? dimension}
        </h2>
        <p className="mb-3 text-xs text-ink-400">{data.note}</p>
        <EquityChart buckets={buckets} overallMean={cohortMean} />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Full audit table</h2>
        <div className="scroll-x">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr className="border-b border-ink-700">
                <th className="py-2 pr-4 font-medium">Group</th>
                <th className="py-2 pr-4 font-medium">Escalations</th>
                <th className="py-2 pr-4 font-medium">Mean response</th>
                <th className="py-2 pr-4 font-medium">Median response</th>
                <th className="py-2 pr-4 font-medium">Mean to assess</th>
                <th className="py-2 font-medium">SLA breach</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {buckets.map((b) => (
                <tr key={b.value} className="border-b border-ink-700/50">
                  <td className="py-2 pr-4">
                    {b.value}
                    {b.low_confidence && (
                      <span className="ml-2 rounded border border-ink-600 px-1.5 py-0.5 text-xs text-ink-400">
                        low n
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{b.escalation_count}</td>
                  <td className="py-2 pr-4">
                    {b.avg_ack_minutes ?? "—"}
                    {b.avg_ack_minutes !== null && "m"}
                  </td>
                  <td className="py-2 pr-4">
                    {b.median_ack_minutes !== null
                      ? `${b.median_ack_minutes.toFixed(1)}m`
                      : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {b.avg_assess_minutes ?? "—"}
                    {b.avg_assess_minutes !== null && "m"}
                  </td>
                  <td className="py-2">
                    {b.sla_breach_pct !== null ? `${b.sla_breach_pct}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">What this screen does not yet cover</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-200">
          This audits response equity — whether the system reacts equally once
          worry is raised. It does not yet audit{" "}
          <em>capture</em> equity: whether nurses raise worry at different rates
          for different patient groups to begin with. That is the subtler bias,
          and it needs a denominator of patient-days per group rather than a
          count of escalations. {data.worry_signal_count} worry signals are
          recorded so far.
        </p>
      </Card>
    </div>
  );
}
