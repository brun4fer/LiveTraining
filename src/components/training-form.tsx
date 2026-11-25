"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderInput, Loader2, Save, Wrench, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";
import { PlannedExerciseDrafts, type PlannedExerciseDraft } from "@/components/planned-exercise-drafts";
import type { AccountPayload, MaintenanceRecord, TrainingDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { uploadPlannedExerciseImage } from "@/lib/planned-exercise-image";

type TrainingExercisesPlanSummary = {
  id: string;
  name: string;
  session: { date: string; season: string; microcycle: string; trainingUnit: string };
  updatedAt: string;
  exerciseCount: number;
};
type TrainingExercisesPlanDetail = {
  id: string;
  name: string;
  session: TrainingExercisesPlanSummary["session"];
  exercises: Array<{ name: string; description: string; diagramSvg: string }>;
};

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
  const [trainingExercisesPlans, setTrainingExercisesPlans] = useState<TrainingExercisesPlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [selectedTrainingExercisesPlan, setSelectedTrainingExercisesPlan] = useState<TrainingExercisesPlanSummary | null>(null);
  const [selectedTrainingExercises, setSelectedTrainingExercises] = useState<TrainingExercisesPlanDetail["exercises"]>([]);
  const [importingPlanId, setImportingPlanId] = useState<string | null>(null);

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

  async function openTrainingExercisesPicker() {
    setError(null);
    setPlanPickerOpen(true);
    setPlansLoading(true);
    try {
      setTrainingExercisesPlans(await apiFetch<TrainingExercisesPlanSummary[]>("/api/training-exercises/plans"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load Training Exercises projects.");
    } finally {
      setPlansLoading(false);
    }
  }

  async function selectTrainingExercisesPlan(plan: TrainingExercisesPlanSummary) {
    const season = seasons.find((item) => item.name === plan.session.season);
    if (!season) {
      setError(`Create the ${plan.session.season} season in Maintenance before importing this plan.`);
      return;
    }
    setImportingPlanId(plan.id);
    setError(null);
    try {
      const detail = await apiFetch<TrainingExercisesPlanDetail>(`/api/training-exercises/plans?projectId=${encodeURIComponent(plan.id)}`);
      setForm((current) => ({
        ...current,
        seasonId: season.id,
        trainingDate: detail.session.date,
        microcycleNumber: detail.session.microcycle,
        trainingUnitNumber: detail.session.trainingUnit,
      }));
      setPlannedExercises([]);
      setSelectedTrainingExercisesPlan({ ...plan, session: detail.session, exerciseCount: detail.exercises.length });
      setSelectedTrainingExercises(detail.exercises);
      setPlanPickerOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not import the selected Training Exercises project.");
    } finally {
      setImportingPlanId(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const training = await apiFetch<TrainingDetail>("/api/trainings", { method: "POST", body: JSON.stringify({
        ...form,
        trainingExercisesProjectId: selectedTrainingExercisesPlan?.id,
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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Preparation</p><h1 className="mt-2 text-3xl font-bold text-white">New {teamName} training</h1><p className="mt-2 text-sm text-slate-400">Define the training unit and choose the participating players.</p></div><div className="flex flex-wrap gap-2"><Button type="button" onClick={openTrainingExercisesPicker}><FolderInput size={15} />Import Training Exercises</Button><Link href="/maintenance"><Button><Wrench size={15} />Open Maintenance</Button></Link></div></div>
    <Panel className="p-5">{loading ? <div className="flex min-h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading configured options…</div> : <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,.8fr)]">
      {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100 lg:col-span-2">{error}</div> : null}
      {planPickerOpen ? <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[.04] p-4 lg:col-span-2"><div className="flex items-start justify-between gap-3"><div><Label>Saved Training Exercises projects</Label><p className="mt-1 text-xs text-slate-400">Choose a presentation to fill the session details and import its exercise diagrams and descriptions.</p></div><Button type="button" size="sm" onClick={() => setPlanPickerOpen(false)}><X size={14} />Close</Button></div>{plansLoading ? <div className="flex items-center gap-2 py-5 text-sm text-slate-400"><Loader2 size={15} className="animate-spin" />Loading saved projects…</div> : trainingExercisesPlans.length === 0 ? <p className="py-5 text-sm text-slate-400">No saved Training Exercises projects were found for this account.</p> : <div className="mt-4 grid gap-2 md:grid-cols-2">{trainingExercisesPlans.map((plan) => <button key={plan.id} type="button" disabled={importingPlanId !== null} onClick={() => void selectTrainingExercisesPlan(plan)} className="rounded-xl border border-white/10 bg-black/15 p-3 text-left transition hover:border-cyan-300/50 hover:bg-cyan-300/[.06] disabled:cursor-wait disabled:opacity-60"><div className="flex items-center justify-between gap-2"><div className="font-semibold text-white">{plan.name}</div>{importingPlanId === plan.id ? <Loader2 size={15} className="animate-spin text-cyan-200" /> : null}</div><div className="mt-1 text-xs text-slate-300">{plan.session.season} · {plan.session.date} · MC {plan.session.microcycle} · TU {plan.session.trainingUnit}</div><div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">{plan.exerciseCount} exercise{plan.exerciseCount === 1 ? "" : "s"}</div></button>)}</div>}</div> : null}
      <div className="grid content-start gap-5 sm:grid-cols-2">
        <label className="grid gap-2 sm:col-span-2"><Label>Season *</Label><Select value={form.seasonId} required onChange={(event) => setForm({ ...form, seasonId: event.target.value })}><option value="">Select…</option>{seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</Select>{seasons.length === 0 ? <span className="text-xs text-amber-200/70">Create a season in Maintenance first.</span> : null}</label>
        <label className="grid gap-2"><Label>Microcycle *</Label><Input type="number" min="1" step="1" value={form.microcycleNumber} onChange={(event) => setForm({ ...form, microcycleNumber: event.target.value })} required /></label>
        <label className="grid gap-2"><Label>Training unit *</Label><Input type="number" min="1" step="1" value={form.trainingUnitNumber} onChange={(event) => setForm({ ...form, trainingUnitNumber: event.target.value })} required /></label>
        <label className="grid gap-2 sm:col-span-2"><Label>Date *</Label><Input type="date" value={form.trainingDate} onChange={(event) => setForm({ ...form, trainingDate: event.target.value })} required /></label>
        <label className="grid gap-2 sm:col-span-2"><Label>Notes</Label><TextArea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/15"><div className="flex items-center justify-between border-b border-white/10 px-3 py-2"><div><Label>Players *</Label><p className="mt-1 text-[11px] text-slate-500">{form.participantIds.length} selected</p></div><Button type="button" size="sm" onClick={() => setForm({ ...form, participantIds: allSelected ? [] : players.map((player) => player.id) })}>{allSelected ? "Clear" : "Select all"}</Button></div><div className="grid max-h-[22rem] grid-cols-1 overflow-y-auto p-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{players.length === 0 ? <p className="p-3 text-sm text-amber-200/70">Create active players in Maintenance first.</p> : players.map((player) => <label key={player.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-200 hover:bg-white/[.05]"><input type="checkbox" checked={form.participantIds.includes(player.id)} onChange={() => togglePlayer(player.id)} className="h-4 w-4 accent-cyan-300" /><span className="flex h-6 min-w-6 items-center justify-center rounded bg-white/[.06] font-mono text-[10px] text-slate-400">{player.shirtNumber ?? "—"}</span><span className="truncate">{player.name}</span></label>)}</div></div>
      <div className="lg:col-span-2">{selectedTrainingExercisesPlan ? <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.06] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-cyan-100">Training Exercises plan selected: {selectedTrainingExercisesPlan.name}</p><p className="mt-1 text-sm text-slate-300">{selectedTrainingExercisesPlan.exerciseCount} exercise{selectedTrainingExercisesPlan.exerciseCount === 1 ? "" : "s"}, diagrams and descriptions will be copied into this training when it is created.</p></div><Button type="button" size="sm" onClick={() => { setSelectedTrainingExercisesPlan(null); setSelectedTrainingExercises([]); }}><X size={14} />Use manual exercises</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{selectedTrainingExercises.map((exercise, index) => <article key={`${exercise.name}-${index}`} className="overflow-hidden rounded-lg border border-white/10 bg-black/20"><Image unoptimized width={640} height={360} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(exercise.diagramSvg)}`} alt={exercise.name} className="aspect-video w-full bg-emerald-950 object-contain" /><div className="p-3"><p className="font-medium text-white">{index + 1}. {exercise.name}</p><p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-300">{exercise.description || "No description."}</p></div></article>)}</div></div> : <PlannedExerciseDrafts exercises={plannedExercises} onChange={setPlannedExercises} />}</div>
      <div className="flex justify-end gap-2 lg:col-span-2"><Link href="/"><Button type="button">Cancel</Button></Link><Button variant="primary" disabled={saving || !form.seasonId || !form.microcycleNumber || !form.trainingUnitNumber || !form.trainingDate || form.participantIds.length === 0}><Save size={16} />{saving ? "Saving…" : "Create training"}</Button></div>
    </form>}</Panel>
  </div>;
}
