# Nurse Worry Layer — Charge Console

Charge nurse and administrator dashboard.

Vite + React 19 + TypeScript + Tailwind v4 + Recharts, with Supabase Realtime
for live escalations. Same stack as the nurse app on purpose: shared `src/lib`
(`supabase.ts`, `api.ts`, `auth.tsx`, `types.ts`) and one mental model across
both repos.

## Running it

```bash
make dev        # http://localhost:5174, foreground
make start      # background
make stop
make help       # all targets
```

**The API must already be running on :5001.** `make dev` checks and warns you
if it is not — start it with `cd ../nursing-backend && make start`.

Fresh clone:

```bash
make install    # npm install + creates .env.local from the example
```
Then fill in `VITE_SUPABASE_ANON_KEY`.

## Sign in

**Password for every account: `WorryLayer!2026`**

| Email | Name | Role | Can do |
|---|---|---|---|
| `charge@mercygeneral.example` | Priya Raghunathan | charge nurse | board, response queue, acknowledge/assess, metrics, equity |
| `admin@mercygeneral.example` | Dana Whitmore | admin | all of the above, plus roster, role changes and the escalation SLA |

Use **Priya** for the demo, with Maria open on the nurse app at :5173.

Nurse accounts (`maria@`, `james@`, `lin@`) will sign in but get a screen
pointing them at the phone app — this console is charge-and-admin only.

## Screens

| Route | Purpose |
|---|---|
| `/` | Board — every active patient, ranked |
| `/escalations` | Response queue — acknowledge / assess |
| `/patients/:id` | NEWS trend with worry taps marked on it |
| `/metrics` | Worry-to-response time |
| `/equity` | Equity audit |
| `/admin` | Roster, roles, assignments, escalation SLA |

## Realtime

`src/lib/realtime.ts` subscribes to `escalations` and `worry_signals` directly
from the browser, filtered by `org_id`. This path is governed by RLS — unlike
the Flask API, which uses the service-role key and bypasses it. A worry tap on
a phone lands on the board in under a second.

Polling at 30–45s remains as a fallback for a dropped websocket, so a ward
station nobody is touching does not go stale.

## Ordering on the board

Not pure risk score. An un-responded escalation outranks everything, then
`auto_escalated` before `open` before `acknowledged`, then worry level, then
risk. The board's job is to make ignored worry impossible to scroll past.

## Charts

Single-mode dark by deliberate choice: this screen runs on a ward workstation
through night shift, and the categorical palette was stepped and validated
against this exact surface (`#0f172a`) — all-pairs CVD ΔE 9.4, normal-vision
ΔE 26.5, contrast ≥ 3:1. A light mode would need its own validated steps rather
than an inverted flip.

- `NewsTrendChart` — one series (NEWS) with worry taps as annotation dots and
  the clinical response bands as recessive background. Single y-axis by
  construction; worry level is an annotation, not a second scale.
- `MetricCharts` — horizontal bars for long category labels, direct value
  labels, status colour reserved for clinical/audit state.
- Status is never colour-alone: every pill carries a glyph, and the patient
  detail chart has a data-table view.

## Build

```bash
make build        # ~902 kB raw / ~257 kB gzipped (Recharts is most of it)
make check        # typecheck + lint + build
```
