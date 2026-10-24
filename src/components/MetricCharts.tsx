import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EquityBucket, ResponseMetrics } from "../lib/dashTypes";
import { REASON_LABELS } from "./Primitives";
import type { ReasonPerformance } from "../lib/dashTypes";

const tooltipStyle = {
  background: "var(--color-ink-900)",
  border: "1px solid var(--color-ink-600)",
  borderRadius: 8,
  fontSize: 12,
} as const;

/* Recharts 3 types formatter values as `ValueType | undefined`. These helpers
   narrow to a number once, so the chart bodies stay readable instead of
   repeating a cast at every call site. */
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

const minuteLabel = (v: unknown) => `${num(v)}m`;
const percentLabel = (v: unknown) => `${num(v)}%`;

const RULE_SHORT: Record<string, string> = {
  news_high: "NEWS high",
  very_worried_plus_drift: "Very worried + drift",
  very_worried_plus_news: "Very worried + NEWS",
  worried_plus_drift_and_news: "Worried + both",
  None: "Not escalated",
};

/**
 * Mean acknowledge time per escalation rule.
 *
 * Horizontal bars: the category labels are long phrases, and rotating them
 * under a vertical axis would make them unreadable. Magnitude comparison, one
 * series, so a single hue and no legend.
 */
export function AckByRuleChart({ metrics }: { metrics: ResponseMetrics }) {
  const data = metrics.by_rule
    .filter((r) => r.mean_ack_minutes !== null)
    .map((r) => ({
      name: RULE_SHORT[r.value] ?? r.value,
      minutes: r.mean_ack_minutes!,
      count: r.count,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  if (data.length === 0) {
    return <NoData>No acknowledged escalations in this window</NoData>;
  }

  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
          barCategoryGap={6}
        >
          <CartesianGrid
            stroke="var(--color-ink-700)"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
            unit="m"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--color-ink-400)" }}
            itemStyle={{ color: "white" }}
            formatter={(v, _n, p) => [
              `${num(v)} min (n=${p.payload.count})`,
              "Mean time to acknowledge",
            ]}
          />
          <Bar
            dataKey="minutes"
            fill="var(--color-series-1)"
            radius={[0, 4, 4, 0]}
          >
            {/* Direct labels rather than relying on the axis -- there are few
                enough bars that every value can be read without a tooltip. */}
            <LabelList
              dataKey="minutes"
              position="right"
              formatter={minuteLabel}
              style={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Equity audit: mean acknowledge time per demographic bucket.
 *
 * Status colour is applied per-bar against the cohort mean, because the
 * question this chart answers is not "how long" but "is any group waiting
 * longer than the rest". Low-confidence buckets are drawn in a muted neutral
 * and labelled, never silently dropped -- hiding a small-n disparity is how an
 * audit tool becomes decorative.
 */
export function EquityChart({
  buckets,
  overallMean,
}: {
  buckets: EquityBucket[];
  overallMean: number | null;
}) {
  const data = buckets
    .filter((b) => b.avg_ack_minutes !== null)
    .map((b) => ({
      name: b.value,
      minutes: b.avg_ack_minutes!,
      count: b.escalation_count,
      lowConfidence: b.low_confidence,
      breach: b.sla_breach_pct ?? 0,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  if (data.length === 0) {
    return <NoData>No escalations to audit in this dimension</NoData>;
  }

  const mean = overallMean ?? 0;

  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 44) }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 76, bottom: 4, left: 8 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke="var(--color-ink-700)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
            unit="m"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--color-ink-400)" }}
            itemStyle={{ color: "white" }}
            formatter={(v, _n, p) => [
              `${num(v)} min · n=${p.payload.count}` +
                (p.payload.lowConfidence ? " (too few to interpret)" : ""),
              "Mean time to acknowledge",
            ]}
          />
          <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={
                  d.lowConfidence
                    ? "var(--color-ink-600)"
                    : mean > 0 && d.minutes > mean * 1.3
                      ? "var(--color-critical)"
                      : "var(--color-series-1)"
                }
              />
            ))}
            <LabelList
              dataKey="minutes"
              position="right"
              formatter={minuteLabel}
              style={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {data.some((d) => d.lowConfidence) && (
        <p className="mt-2 text-xs text-ink-400">
          Grey bars have fewer than 5 escalations — shown for completeness, but
          the difference is not interpretable.
        </p>
      )}
      {mean > 0 && (
        <p className="mt-1 text-xs text-ink-400">
          Cohort mean {mean.toFixed(1)}m. Bars in red wait more than 30% longer
          than the cohort.
        </p>
      )}
    </div>
  );
}

/**
 * Which worry reasons preceded a real deterioration event within 24h.
 *
 * The learn loop made visible. Precision percentage, one series, sorted
 * descending so the ranking is the message.
 */
export function ReasonPerformanceChart({
  reasons,
}: {
  reasons: ReasonPerformance[];
}) {
  const data = reasons
    .filter((r) => r.precision_pct !== null)
    .map((r) => ({
      name: REASON_LABELS[r.reason] ?? r.reason,
      precision: r.precision_pct!,
      count: r.signal_count,
      hits: r.followed_by_event_count,
      lowConfidence: r.low_confidence,
    }));

  if (data.length === 0) {
    return <NoData>Not enough outcome data yet</NoData>;
  }

  return (
    <div style={{ width: "100%", height: Math.max(160, data.length * 40) }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 72, bottom: 4, left: 8 }}
          barCategoryGap={6}
        >
          <CartesianGrid stroke="var(--color-ink-700)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
            unit="%"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "var(--color-ink-400)" }}
            itemStyle={{ color: "white" }}
            formatter={(v, _n, p) => [
              `${num(v)}% — ${p.payload.hits} of ${p.payload.count} preceded an event`,
              "Followed by deterioration",
            ]}
          />
          <Bar dataKey="precision" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell
                key={d.name}
                fill={
                  d.lowConfidence
                    ? "var(--color-ink-600)"
                    : "var(--color-series-3)"
                }
              />
            ))}
            <LabelList
              dataKey="precision"
              position="right"
              formatter={percentLabel}
              style={{ fill: "var(--color-ink-200)", fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-xs text-ink-400">
        Share of worry signals followed by an ICU transfer, rapid response call,
        code, or death within 24 hours.
      </p>
    </div>
  );
}

function NoData({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-ink-400">
      {children}
    </div>
  );
}
