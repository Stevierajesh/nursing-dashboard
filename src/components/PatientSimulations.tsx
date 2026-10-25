import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { Patient, Vitals } from "../lib/types";
import { Button, Card, ErrorNote } from "./Primitives";

type Baseline = Pick<Vitals, "heart_rate" | "resp_rate" | "spo2" | "systolic_bp" | "diastolic_bp" | "temperature_c">;
interface Calibration {
  model_version: string;
  age_band: string;
  sex: string;
  selected_group: string;
}
interface BaselineSample {
  baseline: Baseline;
  calibration: Calibration;
  derived: { pulse_pressure: number; mean_arterial_pressure: number };
}
interface Config {
  scenario: string;
  health_context: string;
  baseline: Baseline;
  duration_minutes: number;
  onset_minutes: number;
  seed: number;
  calibration?: Calibration | null;
}
interface Run {
  id: string; patient_id: string; config: Config;
  status: "ready" | "running" | "paused" | "completed" | "stopped";
  elapsed_seconds: number; last_sample_elapsed: number; running_since: string | null;
}
interface Bed { id: string; unit_id: string; room: string; bed: string; occupied: boolean }
interface Preview extends Baseline { elapsed_seconds: number; news_score: number }
const INITIAL: Config = {
  scenario: "stable", health_context: "", duration_minutes: 10, onset_minutes: 1, seed: 42,
  baseline: { heart_rate: 78, resp_rate: 16, spo2: 98, systolic_bp: 124, diastolic_bp: 78, temperature_c: 36.8 },
};
const SCENARIOS = [
  ["stable", "Stable"], ["respiratory_decline", "Respiratory decline"],
  ["circulatory_decline", "Circulatory decline"], ["recovery", "Recovery"],
];
const FIELDS = [
  ["heart_rate", "Heart rate (bpm)", 40, 140, 1], ["resp_rate", "Respiratory rate (/min)", 8, 30, 1],
  ["spo2", "SpO₂ (%)", 85, 100, 1], ["systolic_bp", "Systolic BP (mmHg)", 85, 200, 1],
  ["diastolic_bp", "Diastolic BP (mmHg)", 45, 120, 1], ["temperature_c", "Temperature (°C)", 35, 39.5, 0.1],
] as const;
const INPUT = "mt-1 min-h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm";

export default function PatientSimulations({ units = [], nurses = [], patient: scopedPatient }: {
  units?: { id: string; name: string }[];
  nurses?: { id: string; full_name: string }[];
  patient?: Patient;
}) {
  const scopedId = scopedPatient?.id;
  const initializedProfile = useRef(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [config, setConfig] = useState<Config>(INITIAL);
  const [referenceAge, setReferenceAge] = useState("all");
  const [referenceSex, setReferenceSex] = useState("all");
  const [mode, setMode] = useState(scopedId ? "existing" : "new");
  const [selectedPatientId, setPatientId] = useState("");
  const patientId = scopedId ?? selectedPatientId;
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [bedId, setBedId] = useState("");
  const [nurseId, setNurseId] = useState("");
  const [preview, setPreview] = useState<Preview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const [p, r, b] = await Promise.all([
      scopedId
        ? api.get<{ patient: Patient }>(`/api/v1/patients/${scopedId}`).then(d => ({ patients: [d.patient] }))
        : api.get<{ patients: Patient[] }>("/api/v1/dashboard/patients"),
      api.get<{ simulations: Run[] }>("/api/v1/simulations"),
      scopedId ? Promise.resolve({ beds: [] as Bed[] }) : api.get<{ beds: Bed[] }>("/api/v1/beds"),
    ]);
    const visibleRuns = scopedId ? r.simulations.filter(run => run.patient_id === scopedId) : r.simulations;
    setPatients(p.patients); setRuns(visibleRuns); setBeds(b.beds); setLoading(false);
    if (scopedId && !initializedProfile.current) {
      const current = visibleRuns[0];
      const patient = p.patients[0];
      setConfig(current ? current.config : {
        ...INITIAL,
        health_context: patient?.health_context ?? "",
        baseline: { ...INITIAL.baseline, ...patient?.baseline_vitals },
      });
      initializedProfile.current = true;
    }
  }, [scopedId]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try { await load(); if (active) setLoadError(""); }
      catch (e) { if (active) { setLoadError(e instanceof Error ? e.message : "Could not load simulations"); setLoading(false); } }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [load]);
  function edit(update: Partial<Config>) { setConfig(c => ({ ...c, ...update })); setPreview([]); }
  async function operate(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await task(); }
    catch (e) { setError(e instanceof Error ? e.message : "Simulation operation failed"); }
    finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    await operate(async () => {
      if (mode === "new") {
        const bed = beds.find(b => b.id === bedId);
        const result = await api.post<{ patient: Patient }>("/api/v1/admin/patients", {
          display_name: name.trim(), mrn_hash: `sim-${crypto.randomUUID()}`,
          unit_id: unitId || units[0]?.id || null,
          ...(bed ? { room: bed.room, bed: bed.bed } : {}),
          simulation: config, nurse_id: nurseId || null,
        });
        setNotice(`${result.patient.display_name} created. Select Start below to begin observations.`);
        setName(""); setBedId("");
      } else {
        if (!patientId) throw new Error("Select a patient first");
        await api.post(`/api/v1/simulations/${patientId}/configure`, config);
        setNotice(scopedId ? "Simulation configured. Select Start in Current run to begin observations." : "Simulation configured. Select Start below to begin observations.");
      }
      await load();
    });
  }
  async function control(run: Run, action: string) {
    await operate(async () => {
      const response = await api.post<{ warning?: string }>(`/api/v1/simulations/${run.patient_id}/control`, { action });
      setNotice(response.warning || (action === "restart" ? "New run started. Previous observations and concerns remain in the patient history." : "Simulation updated."));
      await load();
    });
  }
  const currentRun = runs.find(run => run.patient_id === patientId);
  const hasActiveRun = mode === "existing" && currentRun && ["ready", "running", "paused"].includes(currentRun.status);
  const runControls = (
    <div className="mt-6 space-y-3 border-t border-ink-700 pt-5">
      <h3 className="font-semibold">{scopedId ? "Current run" : "Current runs"}</h3>
      {loading && <p className="text-sm text-ink-400">Loading simulations…</p>}
      {!loading && !runs.length && <p className="text-sm text-ink-400">No simulations configured yet.</p>}
      {runs.map(run => {
        const patient = patients.find(p => p.id === run.patient_id);
        const v = patient?.latest_vitals;
        return <div key={run.id} className="rounded-lg border border-ink-600 p-4">
          <div className="flex flex-wrap justify-between gap-3">
            <div><Link to={`/patients/${run.patient_id}`} className="font-semibold underline">{patient?.display_name || "Inactive patient"}</Link>
              <p className="mt-1 text-sm text-ink-400">{SCENARIOS.find(([id]) => id === run.config.scenario)?.[1]} · {run.status} · last sample {Math.max(0, run.last_sample_elapsed / 60).toFixed(1)} / {run.config.duration_minutes} min</p>
              <p className="mt-1 text-xs text-ink-400">{run.config.calibration ? `Dataset baseline · ${run.config.calibration.selected_group.replace("|", " / ")} · seed ${run.config.seed}` : "Manual baseline"}</p>
              {v && <p className="mt-2 text-sm tabular-nums">HR {v.heart_rate} · RR {v.resp_rate} · SpO₂ {v.spo2}% · BP {v.systolic_bp}/{v.diastolic_bp} · {v.temperature_c}°C <span className="text-xs text-ink-400">at {new Date(v.recorded_at).toLocaleTimeString()}</span></p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {run.status === "ready" && <Button disabled={busy || !patient} onClick={() => void control(run, "start")}>Start</Button>}
              {run.status === "running" && <Button disabled={busy || !patient} onClick={() => void control(run, "pause")}>Pause</Button>}
              {run.status === "paused" && <Button disabled={busy || !patient} onClick={() => void control(run, "resume")}>Resume</Button>}
              {run.status !== "ready" && <Button variant="ghost" disabled={busy || !patient} onClick={() => void control(run, "restart")}>Restart</Button>}
              {["ready", "running", "paused"].includes(run.status) && <Button variant="ghost" disabled={busy || !patient} onClick={() => void control(run, "stop")}>Stop</Button>}
            </div>
          </div>
        </div>;
      })}
      <p className="text-xs text-ink-400">Pausing stops observation generation. Clinical response timers continue in real time. Restarting preserves prior observations, concerns, and escalations.</p>
    </div>
  );
  return <Card>
    <h2 className="text-lg font-semibold">{scopedId ? "Patient simulation" : "Patient simulations"}</h2>
    <p className="mt-2 max-w-3xl text-sm text-ink-400">{scopedId
      ? `Run another scenario for ${scopedPatient.display_name}. Set the profile, preview the trajectory, save, then start the run. Previous observations, concerns, and escalations remain in the patient history.`
      : "Create a patient with a health profile and a scenario, then stream simulated observations into the nurse app and charge board. Nurse concern is entered by a person."}</p>
    <p className="mt-2 text-xs text-ink-400">Real-time playback · observations every 15 seconds · authored demonstration trajectories, not a trained disease model</p>
    {(error || loadError) && <div className="mt-4"><ErrorNote>{error || loadError}</ErrorNote></div>}
    {notice && <p role="status" className="mt-4 text-sm text-good">{notice}</p>}
    {scopedId && runControls}
    <form onSubmit={save} className="mt-5 space-y-4">
      <fieldset disabled={busy || loading || !!loadError} className="space-y-4">
        {!scopedId && <div className="flex flex-wrap gap-2" role="group" aria-label="Patient configuration mode">
          <Button type="button" variant={mode === "new" ? "primary" : "ghost"} onClick={() => setMode("new")}>Create patient</Button>
          <Button type="button" variant={mode === "existing" ? "primary" : "ghost"} onClick={() => setMode("existing")}>Configure existing patient</Button>
        </div>}
        {hasActiveRun && <p className="text-sm text-warning">Stop the current run before saving a new simulation profile.</p>}
        {mode === "new" ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Patient name<input required value={name} maxLength={200} onChange={e => setName(e.target.value)} className={INPUT} /></label>
          <label className="text-sm">Unit<select aria-label="Simulation unit" value={unitId || units[0]?.id || ""} onChange={e => { setUnitId(e.target.value); setBedId(""); }} className={INPUT}>
            {!units.length && <option value="">No units configured</option>}{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select></label>
          <label className="text-sm">Bed<select aria-label="Bed" value={bedId} onChange={e => setBedId(e.target.value)} className={INPUT}>
            <option value="">Assign later</option>{beds.filter(b => b.unit_id === (unitId || units[0]?.id) && !b.occupied).map(b => <option key={b.id} value={b.id}>Room {b.room} · Bed {b.bed}</option>)}
          </select></label>
          <label className="text-sm">Assigned nurse<select aria-label="Assigned nurse" value={nurseId} onChange={e => setNurseId(e.target.value)} className={INPUT}>
            <option value="">Assign later</option>{nurses.map(n => <option key={n.id} value={n.id}>{n.full_name}</option>)}
          </select></label>
        </div> : !scopedId && <label className="block max-w-xl text-sm">Patient<select aria-label="Simulation patient" required value={patientId} onChange={e => setPatientId(e.target.value)} className={INPUT}>
          <option value="">Choose patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.display_name}{p.room ? ` · Room ${p.room}` : ""}</option>)}
        </select></label>}
        <label className="block text-sm">Health context<textarea value={config.health_context} onChange={e => edit({ health_context: e.target.value })} maxLength={1000} rows={2} placeholder="For example: postoperative patient with a history of hypertension" className={INPUT} /></label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Scenario<select aria-label="Scenario" value={config.scenario} onChange={e => edit({ scenario: e.target.value })} className={INPUT}>{SCENARIOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="text-sm">Duration (minutes)<input type="number" required min={2} max={240} value={config.duration_minutes} onChange={e => edit({ duration_minutes: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-sm">Change begins after (minutes)<input type="number" required min={0} max={Math.min(120, config.duration_minutes - 1)} value={config.onset_minutes} onChange={e => edit({ onset_minutes: Number(e.target.value) })} className={INPUT} /></label>
          <label className="text-sm">Variation seed<input type="number" required min={0} max={2147483647} value={config.seed} onChange={e => edit({ seed: Number(e.target.value), calibration: null })} className={INPUT} /></label>
        </div>
        <fieldset><legend className="text-sm font-semibold">Baseline observations</legend>
          <p className="mt-1 text-xs text-ink-400">Starting values for decline scenarios; recovery approaches these values from an initially abnormal state. Health context is descriptive and does not automatically change the trajectory.</p>
          <div className="mt-4 rounded-xl border border-ink-600 bg-ink-900 p-4">
            <h3 className="text-sm font-semibold">Dataset-calibrated baseline</h3>
            <p className="mt-1 text-xs text-ink-400">Sample a complete vital-sign combination from a fitted distribution of 200,020 source observations. The reference groups describe the baseline sample; they do not change the patient’s recorded demographics.</p>
            <div className="mt-3 grid items-end gap-3 sm:grid-cols-3">
              <label className="text-sm">Reference age group<select aria-label="Baseline reference age group" value={referenceAge} onChange={e => setReferenceAge(e.target.value)} className={INPUT}>
                <option value="all">All adults</option>{["18-39", "40-64", "65-79", "80+"].map(age => <option key={age} value={age}>{age}</option>)}
              </select></label>
              <label className="text-sm">Recorded gender in source<select aria-label="Baseline reference gender" value={referenceSex} onChange={e => setReferenceSex(e.target.value)} className={INPUT}>
                <option value="all">All source groups</option><option value="F">Female</option><option value="M">Male</option>
              </select></label>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void operate(async () => {
                const sample = await api.post<BaselineSample>("/api/v1/simulations/calibration/sample", { seed: config.seed, age_band: referenceAge, sex: referenceSex });
                edit({ baseline: sample.baseline, calibration: sample.calibration });
                setNotice("Dataset baseline sampled. Preview the trajectory before saving.");
              })}>Sample from dataset</Button>
            </div>
            <p className="mt-3 text-xs text-ink-400">Source: <a href="https://www.kaggle.com/datasets/nasirayub2/human-vital-sign-dataset" target="_blank" rel="noreferrer" className="underline">Human Vital Sign Dataset</a> (CC0). Clinical provenance is unverified. Baseline combinations are calibrated; changes over time and scenario progression remain authored.</p>
            {config.calibration ? <div className="mt-3 text-xs text-ink-200">
              <p>Baseline source: dataset-calibrated · sampled group {config.calibration.selected_group.replace("|", " / ")} · seed {config.seed}</p>
              <p className="mt-1 break-all text-ink-400">Model: {config.calibration.model_version}</p>
              {config.baseline.systolic_bp != null && config.baseline.diastolic_bp != null && <p className="mt-1 text-ink-400">Derived pulse pressure {config.baseline.systolic_bp - config.baseline.diastolic_bp} mmHg · estimated MAP {(config.baseline.diastolic_bp + (config.baseline.systolic_bp - config.baseline.diastolic_bp) / 3).toFixed(1)} mmHg</p>}
              <button type="button" className="mt-2 min-h-9 underline" onClick={() => edit({ calibration: null })}>Use these values as a manual baseline</button>
            </div> : <p className="mt-3 text-xs text-ink-400">Baseline source: manual. Editing a sampled value or the seed switches to manual.</p>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-3">{FIELDS.map(([key, label, min, max, step]) => <label key={key} className="text-sm">{label}<input type="number" required min={min} max={max} step={step} value={config.baseline[key] ?? ""} onChange={e => edit({ baseline: { ...config.baseline, [key]: Number(e.target.value) }, calibration: null })} className={INPUT} /></label>)}</div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void operate(async () => {
            const result = await api.post<{ observations: Preview[] }>("/api/v1/simulations/preview", config); setPreview(result.observations);
          })}>Preview trajectory</Button>
          <Button type="submit" disabled={busy || !!hasActiveRun || (mode === "existing" && !patientId)}>{busy ? "Working…" : mode === "new" ? "Create simulated patient" : "Save simulation profile"}</Button>
        </div>
      </fieldset>
    </form>
    {preview.length > 0 && <div className="mt-5 overflow-x-auto">
      <p className="mb-2 text-sm font-semibold">Trajectory preview</p>
      <table className="w-full min-w-[500px] text-left text-xs tabular-nums"><thead><tr>{["Elapsed", "HR", "RR", "SpO₂", "BP", "Temp", "NEWS"].map(v => <th key={v} className="py-2 pr-4 text-ink-400">{v}</th>)}</tr></thead>
        <tbody>{preview.map(v => <tr key={v.elapsed_seconds} className="border-t border-ink-700"><td className="py-2">{(v.elapsed_seconds / 60).toFixed(1)}m</td><td>{v.heart_rate}</td><td>{v.resp_rate}</td><td>{v.spo2}%</td><td>{v.systolic_bp}/{v.diastolic_bp}</td><td>{v.temperature_c}°C</td><td>{v.news_score}</td></tr>)}</tbody>
      </table>
    </div>}
    {!scopedId && runControls}
  </Card>;
}
