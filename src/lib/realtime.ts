import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

/**
 * Subscribe to Supabase Realtime for escalation and worry activity.
 *
 * This reads the database directly from the browser rather than polling the
 * Flask API, which is the reason RLS exists on these tables: the service-role
 * key bypasses policies, but this path does not. A charge nurse only receives
 * rows their org policy allows.
 *
 * `onChange` is held in a ref so a caller passing an inline closure does not
 * tear down and rebuild the websocket on every render.
 */
export function useEscalationFeed(
  orgId: string | undefined,
  onChange: (event: {
    table: "escalations" | "worry_signals";
    type: "INSERT" | "UPDATE" | "DELETE";
    row: Record<string, unknown>;
  }) => void,
) {
  const handler = useRef(onChange);
  handler.current = onChange;

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`worry-layer:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "escalations",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) =>
          handler.current({
            table: "escalations",
            type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            row: (payload.new ?? payload.old) as Record<string, unknown>,
          }),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "worry_signals",
          filter: `org_id=eq.${orgId}`,
        },
        (payload) =>
          handler.current({
            table: "worry_signals",
            type: "INSERT",
            row: payload.new as Record<string, unknown>,
          }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);
}

/** Audible alert for a new escalation, synthesised so there is no asset to ship.
 *
 * Deliberately a soft two-tone chime rather than a klaxon. The product's claim
 * is that it reduces alarm fatigue; shipping a jarring alert sound would
 * undercut that in the first thirty seconds of the demo.
 */
export function chime() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;

    [880, 1174].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + i * 0.14);
      gain.gain.linearRampToValueAtTime(0.09, now + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.32);
    });

    setTimeout(() => void ctx.close(), 900);
  } catch {
    // Autoplay policy blocks audio until the user interacts with the page.
    // Not worth surfacing -- the visual pulse carries the alert regardless.
  }
}
