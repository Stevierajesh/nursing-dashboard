import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-400">
      <div
        className="size-5 animate-spin rounded-full border-2 border-ink-600 border-t-white"
        role="status"
        aria-label={label}
      />
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "critical";
}) {
  const styles = {
    primary: "bg-white text-ink-900 hover:bg-ink-200 disabled:bg-ink-600",
    ghost:
      "border border-ink-600 bg-ink-700 text-white hover:bg-ink-600 disabled:opacity-50",
    critical: "bg-critical text-white hover:brightness-110 disabled:opacity-50",
  }[variant];

  return (
    <button
      {...rest}
      className={`min-h-9 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-ink-700 bg-ink-800 p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Stat tile. A single number with its label -- the right form when the data's
 * job is one headline value, not a comparison.
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const valueTone = {
    neutral: "text-white",
    good: "text-good",
    warning: "text-warning",
    critical: "text-critical",
  }[tone];

  return (
    <Card>
      <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-3xl font-bold tabular-nums ${valueTone}`}>
          {value}
        </span>
        {unit && <span className="text-sm text-ink-400">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-xs text-ink-400">{hint}</div>}
    </Card>
  );
}

/**
 * NEWS badge. Status colour, and always paired with the literal score, so
 * state is never communicated by colour alone.
 */
export function NewsBadge({
  score,
  band,
}: {
  score: number | null;
  band: string;
}) {
  if (score === null)
    return <span className="text-xs text-ink-400">no vitals</span>;

  const tone =
    {
      high: "border-critical/40 bg-critical/15 text-critical",
      medium: "border-warning/40 bg-warning/15 text-warning",
      low: "border-ink-600 bg-ink-700 text-ink-200",
      none: "border-good/30 bg-good/10 text-good",
    }[band] ?? "border-ink-600 bg-ink-700 text-ink-200";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${tone}`}
    >
      NEWS {score}
    </span>
  );
}

/**
 * Escalation status pill. Carries an icon glyph alongside the colour so the
 * state survives colourblindness and greyscale printing.
 */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: string; tone: string }> = {
    auto_escalated: {
      label: "No response",
      icon: "⚠",
      tone: "border-critical/50 bg-critical/20 text-critical",
    },
    open: {
      label: "Awaiting response",
      icon: "●",
      tone: "border-warning/50 bg-warning/20 text-warning",
    },
    acknowledged: {
      label: "Acknowledged",
      icon: "◐",
      tone: "border-series-1/50 bg-series-1/20 text-series-1",
    },
    assessed: {
      label: "Assessed",
      icon: "✓",
      tone: "border-good/40 bg-good/15 text-good",
    },
    resolved: {
      label: "Resolved",
      icon: "✓",
      tone: "border-ink-600 bg-ink-700 text-ink-200",
    },
  };
  const s = map[status] ?? {
    label: status,
    icon: "·",
    tone: "border-ink-600 bg-ink-700 text-ink-200",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${s.tone}`}
    >
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export function WorryBadge({ level }: { level: 0 | 1 | 2 }) {
  if (level === 0) return null;
  const tone =
    level === 2
      ? "border-critical/40 bg-critical/15 text-critical"
      : "border-warning/40 bg-warning/15 text-warning";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      <span aria-hidden>{level === 2 ? "▲" : "△"}</span>
      {level === 2 ? "Very worried" : "Slightly worried"}
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical"
    >
      {children}
    </div>
  );
}

export function Empty({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <Card className="text-center">
      <div className="font-medium text-ink-200">{title}</div>
      {body && <div className="mt-1 text-sm text-ink-400">{body}</div>}
    </Card>
  );
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Elapsed minutes since an ISO timestamp, for live SLA countdowns. */
export function minutesSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

export const REASON_LABELS: Record<string, string> = {
  breathing_off: "Breathing off",
  not_himself: "Not themself",
  color: "Colour",
  pain: "Pain",
  agitation: "Agitation",
  output: "Urine output",
  just_a_feeling: "Just a feeling",
};
