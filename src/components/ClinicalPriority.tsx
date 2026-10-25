import type { Escalation, NewsAlert } from "../lib/types";

export default function ClinicalPriority({ news, escalation }: { news: NewsAlert; escalation?: Pick<Escalation, "status"> | null }) {
  const active = escalation && ["open", "acknowledged", "auto_escalated"].includes(escalation.status);
  const urgent = news.band === "medium" || news.band === "single_red";
  const tone = active || news.band === "high" ? "border-critical/40 bg-critical/10 text-critical" : urgent ? "border-warning/40 bg-warning/10 text-warning" : "border-ink-600 text-ink-400";
  const label = active ? escalation.status === "acknowledged" ? "Escalation acknowledged" : escalation.status === "auto_escalated" ? "Escalation overdue" : "Escalation open" : news.band === "high" ? "NEWS high response threshold" : urgent ? "NEWS urgent review threshold" : "NEWS status";
  return <div aria-label="Patient priority" className={`rounded-xl border px-3 py-2 ${tone}`}>
    <p className="text-sm font-bold">{label}</p>
    <p className="mt-1 text-xs">{news.score == null ? "NEWS unavailable" : `NEWS ${news.score} · ${news.band === "single_red" ? "Single parameter 3" : news.band === "none" ? "Zero" : news.band}`} {active ? "· Assessment or resolution pending" : ""}</p>
  </div>;
}
