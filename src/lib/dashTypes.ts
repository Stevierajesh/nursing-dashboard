import type { Escalation, Patient, WorrySignal } from "./types";

export interface EscalationRow extends Escalation {
  patient: { id: string; display_name: string; room: string | null } | null;
  worry_signal:
    | (Pick<WorrySignal, "id" | "level" | "reasons" | "note" | "created_at"> & {
        nurse: { id: string; full_name: string } | null;
      })
    | null;
  ack_by: { id: string; full_name: string } | null;
  assess_by: { id: string; full_name: string } | null;
}

export interface Summary {
  active_patients: number;
  open_escalations: number;
  sla_breaches: number;
}

export interface TimingStats {
  count: number;
  mean_minutes: number | null;
  median_minutes: number | null;
  p90_minutes: number | null;
}

export interface ResponseMetrics {
  window_days: number;
  total_escalations: number;
  acknowledge: TimingStats;
  assess: TimingStats;
  sla_breaches: number;
  sla_breach_pct: number;
  still_unanswered: number;
  by_rule: { value: string; count: number; mean_ack_minutes: number | null }[];
  by_worry_level: {
    value: string;
    count: number;
    mean_ack_minutes: number | null;
  }[];
}

export interface EquityBucket {
  dimension: string;
  value: string;
  escalation_count: number;
  avg_ack_minutes: number | null;
  avg_assess_minutes: number | null;
  median_ack_minutes: number | null;
  sla_breach_pct: number | null;
  low_confidence: boolean;
}

export interface EquityResponse {
  dimensions: string[];
  response_time_audit: EquityBucket[];
  worry_signal_count: number;
  note: string;
}

export interface ReasonPerformance {
  reason: string;
  signal_count: number;
  followed_by_event_count: number;
  precision_pct: number | null;
  low_confidence: boolean;
}

export type BoardPatient = Patient;
