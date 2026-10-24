import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { ReasonPerformance, ResponseMetrics } from "../lib/dashTypes";
import {
  AckByRuleChart,
  ReasonPerformanceChart,
} from "../components/MetricCharts";
import { Card, ErrorNote, Spinner, Stat } from "../components/Primitives";

/**
 * Worry-to-response time.
 *
 * The metric the pitch claims hospitals do not currently track. Median leads
 * because response-time distributions are right-skewed and one forgotten
 * escalation drags the mean; both are shown so neither can hide the other.
 */
export default function Metrics() {
  const [days, setDays] = useState(7);
  const [metrics, setMetrics] = useState<ResponseMetrics | null>(null);
  const [reasons, setReasons] = useState<ReasonPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.get<ResponseMetrics>(
        `/api/v1/metrics/worry-to-response?days=${days}`,
      ),
      api.get<{ reasons: ReasonPerformance[] }>("/api/v1/metrics/worry-reasons"),
    ])
      .then(([m, r]) => {
        if (!active) return;
        setMetrics(m);
        setReasons(r.reasons);
        setError(null);
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  if (loading) return <Spinner label="Loading metrics" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!metrics) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Worry-to-response time</h1>
          <p className="text-sm text-ink-400">
            How long a worried nurse waits for someone to respond.
          </p>
        </div>
        {/* Time range control, single row above the charts. */}
        <div
          className="flex gap-1 rounded-lg border border-ink-600 bg-ink-800 p-1"
          role="group"
          aria-label="Time range"
        >
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`min-h-8 rounded px-3 text-sm font-medium transition ${
                days === d
                  ? "bg-white text-ink-900"
                  : "text-ink-200 hover:bg-ink-700"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Median time to respond"
          value={metrics.acknowledge.median_minutes ?? "—"}
          unit={metrics.acknowledge.median_minutes !== null ? "min" : undefined}
          hint={`${metrics.acknowledge.count} acknowledged`}
        />
        <Stat
          label="90th percentile"
          value={metrics.acknowledge.p90_minutes ?? "—"}
          unit={metrics.acknowledge.p90_minutes !== null ? "min" : undefined}
          hint="The slow tail is what hurts patients"
          tone={
            (metrics.acknowledge.p90_minutes ?? 0) > 20 ? "warning" : "neutral"
          }
        />
        <Stat
          label="SLA breaches"
          value={`${metrics.sla_breach_pct}%`}
          hint={`${metrics.sla_breaches} of ${metrics.total_escalations} escalations`}
          tone={metrics.sla_breach_pct > 10 ? "critical" : "good"}
        />
        <Stat
          label="Still unanswered"
          value={metrics.still_unanswered}
          hint="No acknowledgement at all"
          tone={metrics.still_unanswered > 0 ? "critical" : "good"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 font-semibold">
            Mean response time by escalation rule
          </h2>
          <p className="mb-3 text-xs text-ink-400">
            Whether responders treat a worry-driven page differently from a
            vitals-driven one.
          </p>
          <AckByRuleChart metrics={metrics} />
        </Card>

        <Card>
          <h2 className="mb-1 font-semibold">
            Which worry reasons predicted deterioration
          </h2>
          <p className="mb-3 text-xs text-ink-400">
            The learn loop — ranked by how often each reason preceded a real
            event.
          </p>
          <ReasonPerformanceChart reasons={reasons} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Response time by worry level</h2>
        <div className="scroll-x">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-ink-400">
              <tr className="border-b border-ink-700">
                <th className="py-2 pr-4 font-medium">Worry level</th>
                <th className="py-2 pr-4 font-medium">Escalations</th>
                <th className="py-2 font-medium">Mean response</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {metrics.by_worry_level.map((r) => (
                <tr key={r.value} className="border-b border-ink-700/50">
                  <td className="py-2 pr-4">
                    {r.value === "2"
                      ? "Very worried"
                      : r.value === "1"
                        ? "Slightly worried"
                        : r.value === "None" || r.value === "null"
                          ? "No worry (vitals only)"
                          : r.value}
                  </td>
                  <td className="py-2 pr-4">{r.count}</td>
                  <td className="py-2">
                    {r.mean_ack_minutes !== null
                      ? `${r.mean_ack_minutes} min`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
