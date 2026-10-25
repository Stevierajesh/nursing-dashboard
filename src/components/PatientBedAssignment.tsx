import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { Patient } from "../lib/types";
import { Button, Card, ErrorNote } from "./Primitives";

type LocationPatient = Pick<Patient, "id" | "display_name" | "unit_id" | "room" | "bed">;
interface Bed {
  id: string;
  unit_id: string;
  room: string;
  bed: string;
  occupied: boolean;
}
interface Unit { id: string; name: string }
const INPUT = "mt-1 min-h-10 w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm disabled:opacity-50";

export default function PatientBedAssignment({ patientId, onMoved }: {
  patientId?: string;
  onMoved?: (patient: LocationPatient) => void;
}) {
  const [patients, setPatients] = useState<LocationPatient[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [bedId, setBedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [p, b, u] = await Promise.all([
        api.get<{ patients: LocationPatient[] }>("/api/v1/dashboard/patients"),
        api.get<{ beds: Bed[] }>("/api/v1/beds"),
        api.get<{ units: Unit[] }>("/api/v1/admin/units"),
      ]);
      setPatients(p.patients);
      setBeds(b.beds);
      setUnits(u.units);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load bed availability");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const patient = patients.find(p => p.id === (patientId ?? selectedId));
  const target = beds.find(b => b.id === bedId && !b.occupied);
  const currentUnit = units.find(u => u.id === patient?.unit_id);
  const available = beds.filter(b => !b.occupied)
    .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }) || a.bed.localeCompare(b.bed, undefined, { numeric: true }));

  async function move(e: FormEvent) {
    e.preventDefault();
    if (!patient || !target || busy || loading || loadError) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.patch<{ patient: LocationPatient }>(`/api/v1/patients/${patient.id}/location`, { bed_id: target.id });
      setPatients(previous => previous.map(p => p.id === result.patient.id ? result.patient : p));
      setBedId("");
      setNotice(`${patient.display_name} moved to ${units.find(u => u.id === target.unit_id)?.name ?? "unit"}, Room ${target.room}, Bed ${target.bed}.`);
      onMoved?.(result.patient);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move patient");
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Bed assignment</h2>
      <Button type="button" variant="ghost" disabled={loading || busy} onClick={() => { setLoading(true); void refresh(); }}>
        {loading ? "Loading beds…" : "Refresh beds"}
      </Button>
    </div>
    <p className="mt-2 text-sm text-ink-400">Move a patient to an available bed on either floor.</p>
    {loadError && <div className="mt-3"><ErrorNote>{loadError}</ErrorNote></div>}
    {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
    {notice && <p role="status" className="mt-3 text-sm text-good">{notice}</p>}
    <form onSubmit={move} className="mt-4 space-y-4">
      {!patientId && <label className="block text-sm">Patient
        <select required value={selectedId} disabled={busy || loading || !!loadError} className={INPUT}
          onChange={e => { setSelectedId(e.target.value); setBedId(""); setError(""); setNotice(""); }}>
          <option value="">Select a patient</option>
          {[...patients].sort((a, b) => a.display_name.localeCompare(b.display_name)).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
        </select>
      </label>}
      {patient && <p className="text-sm text-ink-400">Current location: {[currentUnit?.name, patient.room ? `Room ${patient.room}` : null, patient.bed ? `Bed ${patient.bed}` : "No bed assigned"].filter(Boolean).join(" · ")}</p>}
      {!loading && !loadError && patients.length === 0 && <p className="text-sm text-ink-400">No active patients to move.</p>}
      <label className="block text-sm">Destination bed
        <select required value={target ? bedId : ""} disabled={!patient || busy || loading || !!loadError} className={INPUT}
          onChange={e => { setBedId(e.target.value); setError(""); setNotice(""); }}>
          <option value="">Select an available bed</option>
          {units.map(unit => {
            const choices = available.filter(b => b.unit_id === unit.id);
            return choices.length ? <optgroup key={unit.id} label={unit.name}>
              {choices.map(b => <option key={b.id} value={b.id}>Room {b.room} · Bed {b.bed}</option>)}
            </optgroup> : null;
          })}
        </select>
      </label>
      {!loading && !loadError && available.length === 0 && <p className="text-sm text-ink-400">No beds are currently available.</p>}
      <Button type="submit" disabled={!patient || !target || busy || loading || !!loadError}>{busy ? "Moving…" : "Move patient"}</Button>
    </form>
  </Card>;
}
