"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Save, Wrench } from "lucide-react";
import Link from "next/link";

import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";
import { PlannedExerciseDrafts, type PlannedExerciseDraft } from "@/components/planned-exercise-drafts";
import type { AccountPayload, MaintenanceRecord, TrainingDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { uploadPlannedExerciseImage } from "@/lib/planned-exercise-image";

export function TrainingForm() {
  const router = useRouter();
  const [form, setForm] = useState({ seasonId: "", microcycleNumber: "", trainingUnitNumber: "", trainingDate: new Date().toISOString().slice(0, 10), notes: "", participantIds: [] as string[] });
  const [plannedExercises, setPlannedExercises] = useState<PlannedExerciseDraft[]>([]);
  const [seasons, setSeasons] = useState<MaintenanceRecord[]>([]);
  const [players, setPlayers] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Team");

  useEffect(() => {
    Promise.all([
      apiFetch<AccountPayload>("/api/account"),
      apiFetch<MaintenanceRecord[]>("/api/maintenance/seasons"),
      apiFetch<MaintenanceRecord[]>("/api/maintenance/players"),
    ]).then(([account, seasonRows, playerRows]) => {
      setTeamName(account.teamName || "Team");
      setSeasons(seasonRows);
      const activePlayers = playerRows.filter((player) => player.active !== false);
      setPlayers(activePlayers);
      setForm((current) => ({ ...current, participantIds: activePlayers.map((player) => player.id) }));
    }).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false));
  }, []);

  const allSelected = useMemo(() => players.length > 0 && form.participantIds.length === players.length, [form.participantIds.length, players.length]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const training = await apiFetch<TrainingDetail>("/api/trainings", { method: "POST", body: JSON.stringify({
        ...form,
        plannedExercises: plannedExercises.map((exercise) => ({ name: exercise.name, description: exercise.description, durationMinutes: exercise.durationMinutes })),
      }) });
      let failedImages = 0;
      for (let index = 0; index < plannedExercises.length; index += 1) {
        const file = plannedExercises[index].imageFile;
        const saved = training.plannedExercises[index];
        if (file && saved) {
          try { await uploadPlannedExerciseImage(training.id, saved.id, file); }
          catch { failedImages += 1; }
        }
      }
      if (failedImages) {
        window.alert(`The training was created, but ${failedImages} exercise image${failedImages === 1 ? "" : "s"} could not be uploaded. You can retry from the training plan.`);
        router.push(`/trainings/${training.id}/plan`);
      } else {
        router.push(`/live/${training.id}`);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the training.");
      setSaving(false);
    }
  }

  function togglePlayer(id: string) {
    setForm((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((playerId) => playerId !== id) : [...current.participantIds, id] }));
  }

  return <div className="mx-auto max-w-5xl space-y-5">
    <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={15} />Back to trainings</Link>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Preparation</p><h1 className="mt-2 text-3xl font-bold text-white">New {teamName} training</h1><p className="mt-2 text-sm text-slate-400">Define the training unit and choose the participating players.</p></div><Link href="/maintenance"><Button><Wrench size={15} />Open Maintenance</Button></Link></div>
    <Panel className="p-5">{loading ? <div className="flex min-h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading configured options…</div> : <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)]">
      {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100 lg:col-span-2">{error}</div> : null}
      <div className="grid content-start gap-5 sm:grid-cols-2">
        <label className="grid gap-2 sm:col-span-2"><Label>Season *</Label><Select value={form.seasonId} required onChange={(event) => setForm({ ...form, seasonId: event.target.value })}><option value="">Select…</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select>{seasons.length === 0 ? <span className="text-xs text-amber-200/70">Create a season in Maintenance first.</span> : null}</label>
        <label className="grid gap-2"><Label>Microcycle *</Label><Input type="number" min="1" step="1" value={form.microcycleNumber} onChange={(event) => setForm({ ...form, microcycleNumber: event.target.value })} required /></label>
        <label className="grid gap-2"><Label>Training unit *</Label><Input type="number" min="1" step="1" value={form.trainingUnitNumber} onChange={(event) => setForm({ ...form, trainingUnitNumber: event.target.value })} required /></label>
        <label className="grid gap-2 sm:col-span-2"><Label>Date *</Label><Input type="date" value={form.trainingDate} onChange={(event) => setForm({ ...form, trainingDate: event.target.value })} required /></label>
        <label className="grid gap-2 sm:col-span-2"><Label>Notes</Label><TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15"><div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><div><Label>Players *</Label><p className="mt-1 text-[11px] text-slate-500">{form.participantIds.length} selected</p></div><Button type="button" size="sm" onClick={() => setForm({ ...form, participantIds: allSelected ? [] : players.map((player) => player.id) })}>{allSelected ? "Clear" : "Select all"}</Button></div><div className="grid max-h-[22rem] grid-cols-1 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{players.length === 0 ? <p className="p-3 text-sm text-amber-200/70">Create active players in Maintenance first.</p> : players.map((player) => <label key={player.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/[.05]"><input type="checkbox" checked={form.participantIds.includes(player.id)} onChange={() => togglePlayer(player.id)} className="h-4 w-4 accent-cyan-300" /><span className="flex h-6 min-w-6 items-center justify-center rounded bg-white/[.06] font-mono text-[10px] text-slate-400">{player.shirtNumber ?? "—"}</span><span className="truncate">{player.name}</span></label>)}</div></div>
      <div className="lg:col-span-2"><PlannedExerciseDrafts exercises={plannedExercises} onChange={setPlannedExercises} /></div>
      <div className="flex justify-end gap-2 lg:col-span-2"><Link href="/"><Button type="button">Cancel</Button></Link><Button variant="primary" disabled={saving || !form.seasonId || !form.microcycleNumber || !form.trainingUnitNumber || !form.trainingDate || form.participantIds.length === 0}><Save size={16} />{saving ? "Saving…" : "Create training"}</Button></div>
    </form>}</Panel>
  </div>;
}
