import { WORRY_LABELS } from "../lib/types";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Vitals, WorrySignal } from "../lib/types";
import { REASON_LABELS } from "./Primitives";

/**
 * NEWS over time with nurse worry signals marked on it.
 *
 * This chart is the argument. One series (NEWS) so no legend box is needed --
 * the title names it -- with worry taps as annotation dots. When a worry dot
 * sits to the left of the point where NEWS crosses into the response band, the
 * nurse saw it first, and that gap is the whole product.
 *
 * Single y-axis by construction: worry level is an annotation, not a second
 * scale. A dual-axis version of this chart would be unreadable and is the one
 * thing never to do here.
 */

interface Point {
  t: number;
  label: string;
  news: number;
}

export default function NewsTrendChart({
  vitals,
  worrySignals,
  height = 260,
}: {
  vitals: Vitals[];
  worrySignals: WorrySignal[];
  height?: number;
}) {
  const data: Point[] = vitals.map((v) => ({
    t: new Date(v.recorded_at).getTime(),
    label: new Date(v.recorded_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    news: v.news_score ?? 0,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-400">
        No vitals recorded yet
      </div>
    );
  }

  const maxNews = Math.max(5, ...data.map((d) => d.news));
  const domainMax = Math.ceil((maxNews + 1) / 2) * 2;

  // Place each worry signal at the NEWS value in effect when it was raised,
  // so the dot sits on the line rather than floating.
  const markers = worrySignals
    .filter((w) => w.level > 0)
    .map((w) => {
      const t = new Date(w.created_at).getTime();
      const nearest = data.reduce((best, d) =>
        Math.abs(d.t - t) < Math.abs(best.t - t) ? d : best,
      );
      return { t, news: nearest.news, signal: w };
    })
    .filter((m) => m.t >= data[0].t - 36e5 && m.t <= data.at(-1)!.t + 36e5);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, bottom: 4, left: -16 }}
        >
          {/* Clinical response bands as recessive background, so a reader can
              see where the patient sits without reading the axis. */}
          <ReferenceArea
            y1={7}
            y2={domainMax}
            fill="var(--color-critical)"
            fillOpacity={0.08}
          />
          <ReferenceArea
            y1={5}
            y2={7}
            fill="var(--color-warning)"
            fillOpacity={0.08}
          />

          <CartesianGrid
            stroke="var(--color-ink-700)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            domain={[0, domainMax]}
            allowDecimals={false}
            tick={{ fill: "var(--color-ink-400)", fontSize: 11 }}
            stroke="var(--color-ink-700)"
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-ink-900)",
              border: "1px solid var(--color-ink-600)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--color-ink-400)" }}
            itemStyle={{ color: "white" }}
            formatter={(v) => [String(v), "NEWS"]}
          />

          <Line
            type="monotone"
            dataKey="news"
            stroke="var(--color-series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--color-series-1)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />

          {markers.map((m, i) => (
            <ReferenceDot
              key={m.signal.id}
              x={
                data.reduce((best, d) =>
                  Math.abs(d.t - m.t) < Math.abs(best.t - m.t) ? d : best,
                ).label
              }
              y={m.news}
              r={7}
              fill={
                m.signal.level === 4
                  ? "var(--color-critical)"
                  : "var(--color-warning)"
              }
              /* 2px surface ring so the marker reads as distinct where it
                 overlaps the line. */
              stroke="var(--color-ink-800)"
              strokeWidth={2}
              label={
                i === markers.length - 1
                  ? {
                      value: WORRY_LABELS[m.signal.level].toLowerCase(),
                      position: "top",
                      fill: "var(--color-ink-200)",
                      fontSize: 11,
                    }
                  : undefined
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {markers.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs">
          {markers
            .slice()
            .reverse()
            .slice(0, 4)
            .map((m) => (
              <li key={m.signal.id} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 size-2 shrink-0 rounded-full"
                  style={{
                    background:
                      m.signal.level === 4
                        ? "var(--color-critical)"
                        : "var(--color-warning)",
                  }}
                />
                <span className="text-ink-200">
                  <span className="font-medium">
                    {m.signal.nurse?.full_name ?? "A nurse"}
                  </span>{" "}
                  was {WORRY_LABELS[m.signal.level].toLowerCase()}
                  {m.signal.reasons.length > 0 && (
                    <>
                      {" — "}
                      {m.signal.reasons
                        .map((r) => REASON_LABELS[r] ?? r)
                        .join(", ")}
                    </>
                  )}
                  {m.signal.note && (
                    <span className="text-ink-400"> “{m.signal.note}”</span>
                  )}
                  <span className="text-ink-500">
                    {" · NEWS was "}
                    {m.news}
                  </span>
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
