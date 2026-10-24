export type Role = "admin" | "charge_nurse" | "nurse";

export type WorryReason =
  | "breathing_off"
  | "not_himself"
  | "color"
  | "pain"
  | "agitation"
  | "output"
  | "just_a_feeling";

/** Quick-pick reasons, in the order they appear on the tap screen. */
export const WORRY_REASONS: { id: WorryReason; label: string }[] = [
  { id: "breathing_off", label: "Breathing off" },
  { id: "not_himself", label: "Not themself" },
  { id: "color", label: "Colour" },
  { id: "pain", label: "Pain" },
  { id: "agitation", label: "Agitation" },
  { id: "output", label: "Urine output" },
  { id: "just_a_feeling", label: "Just a feeling" },
];

export const REASON_LABELS: Record<string, string> = Object.fromEntries(
  WORRY_REASONS.map((r) => [r.id, r.label]),
);

export interface Me {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    unit_id: string | null;
    is_org_wide: boolean;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    worry_sla_minutes: number;
  } | null;
  unit: { id: string; name: string } | null;
}

export interface Vitals {
  id: string;
  patient_id: string;
  recorded_at: string;
  heart_rate: number | null;
  resp_rate: number | null;
  spo2: number | null;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  temperature_c: number | null;
  supplemental_o2: boolean;
  consciousness: string | null;
  news_score: number | null;
}

export interface WorrySignal {
  id: string;
  patient_id: string;
  nurse_id: string;
  level: 0 | 1 | 2;
  reasons: WorryReason[];
  note: string | null;
  capture_ms: number | null;
  created_at: string;
  nurse?: { id: string; full_name: string };
}

export type EscalationStatus =
  | "open"
  | "acknowledged"
  | "assessed"
  | "resolved"
  | "auto_escalated";

export interface Escalation {
  id: string;
  patient_id: string;
  worry_signal_id: string | null;
  rule: string;
  rule_label?: string;
  status: EscalationStatus;
  triggered_at: string;
  sla_deadline: string;
  acknowledged_at: string | null;
  assessed_at: string | null;
}

export interface Patient {
  id: string;
  display_name: string;
  room: string | null;
  unit_id: string | null;
  age_band: string | null;
  sex: string | null;
  race_code: string | null;
  primary_language: string | null;
  admitted_at: string;
  risk_score: number;
  risk_components: { worry: number; vitals: number; trend: number } | null;
  risk_inputs: Record<string, unknown> | null;
  latest_vitals: Vitals | null;
  latest_news: number | null;
  news_band: "none" | "low" | "medium" | "high";
  latest_worry: WorrySignal | null;
  open_escalation: Escalation | null;
  escalation_rule_label: string | null;
}

export interface WorryResponse {
  worry_signal: WorrySignal;
  risk: {
    score: number;
    worry_component: number;
    vitals_component: number;
    trend_component: number;
    latest_news: number;
    news_band: string;
    trend_slope_per_hour: number;
  };
  escalated: boolean;
  escalation: Escalation | null;
  message: string;
}

export interface PatientDetail {
  patient: Patient;
  vitals: Vitals[];
  worry_signals: WorrySignal[];
  escalations: Escalation[];
  risk: {
    score: number;
    worry_component: number;
    vitals_component: number;
    trend_component: number;
    latest_news: number;
    news_band: string;
    trend_slope_per_hour: number;
    worry_level: number;
    inputs: Record<string, unknown>;
  };
}
