"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, Clapperboard, Dumbbell, Pencil, Play, Plus, Radio, Search, Trash2, Users } from "lucide-react";

import { TrainingEditDialog } from "@/components/training-edit-dialog";
import { Badge, Button, Input, Panel } from "@/components/ui";
import type { AccountPayload, TrainingDetail, TrainingSummary } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function Dashboard() {
  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingTraining, setEditingTraining] = useState<TrainingDetail | null>(null);
  const [teamName, setTeamName] = useState("Team");

  useEffect(() => {
    Promise.all([apiFetch<TrainingSummary[]>("/api/trainings"), apiFetch<AccountPayload>("/api/account")])
      .then(([rows, account]) => { setTrainings(rows); setTeamName(account.teamName || "Team"); })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredTrainings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return trainings;
    return trainings.filter((training) =>
      [training.title, training.season, `mc ${training.microcycleNumber}`, `tu ${training.trainingUnitNumber}`]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [trainings, query]);

  const totals = useMemo(() => ({
    trainings: trainings.length,
    moments: trainings.reduce((sum, training) => sum + training.momentCount, 0),
    playerActions: trainings.reduce((sum, training) => sum + training.playerActionCount, 0),
  }), [trainings]);

  async function removeTraining(training: TrainingSummary) {
    if (!window.confirm(`Delete "${training.title}" and all associated exercises, moments and player actions?`)) return;
    await apiFetch<void>(`/api/trainings/${training.id}`, { method: "DELETE" });
    setTrainings((current) => current.filter((item) => item.id !== training.id));
    if (editingTraining?.id === training.id) setEditingTraining(null);
  }

  async function openEdit(trainingId: string) {
    try {
      setEditingTraining(await apiFetch<TrainingDetail>(`/api/trainings/${trainingId}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this training.");
    }
  }

  async function saveTraining(input: Record<string, unknown>) {
    if (!editingTraining) return;
    const saved = await apiFetch<TrainingDetail>(`/api/trainings/${editingTraining.id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    setTrainings((current) => current.map((item) => item.id === saved.id ? { ...item, ...saved, momentCount: saved.moments.length, playerActionCount: saved.playerActions.length } : item));
    setEditingTraining(null);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-lg border border-white/10 bg-gradient-to-br from-white/[.08] to-cyan-300/[.04] p-5 shadow-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[.28em] text-cyan-200/80">Analysis hub</p>
              <h1 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{teamName} trainings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Open a training, connect the camera and share a rewindable live recording with the full staff.</p>
            </div>
            <Link href="/trainings/new" className="shrink-0"><Button variant="primary"><Plus size={17} />Create new training</Button></Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Stat label="Trainings" value={totals.trainings} />
          <Stat label="Moments" value={totals.moments} />
          <Stat label="Player actions" value={totals.playerActions} />
        </div>
      </section>

      {error ? <Panel className="border-red-400/30 p-4 text-sm text-red-100">{error}</Panel> : null}
      {!loading && trainings.length > 0 ? <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} /><Input aria-label="Search trainings" className="pl-10" placeholder="Search by season, microcycle or unit" value={query} onChange={(event) => setQuery(event.target.value)} /></div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? Array.from({ length: 6 }).map((_, index) => <Panel key={index} className="h-56 animate-pulse bg-white/[.035]" />) : trainings.length === 0 ? (
          <Panel className="md:col-span-2 xl:col-span-3"><div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><Clapperboard className="text-cyan-200" size={42} /><h2 className="mt-4 text-lg font-semibold text-white">No trainings yet</h2><p className="mt-2 max-w-md text-sm text-slate-400">Create the first training to record exercises, tactical moments and individual player actions.</p><Link href="/trainings/new" className="mt-5"><Button variant="primary"><Plus size={17} />New training</Button></Link></div></Panel>
        ) : filteredTrainings.length === 0 ? <Panel className="md:col-span-2 xl:col-span-3 p-8 text-center text-sm text-slate-400">No trainings found for “{query}”.</Panel> : filteredTrainings.map((training) => (
          <Panel key={training.id} className="flex min-h-60 flex-col justify-between overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-white">{training.title}</h2><p className="mt-1 truncate text-sm text-slate-400">{teamName} · {training.season}</p></div><Badge className="shrink-0 border-cyan-300/20 bg-cyan-300/10 text-cyan-100">{training.momentCount} moments</Badge></div>
              <div className="mt-4 grid gap-2 text-sm text-slate-400"><Info icon={<Calendar size={15} />} value={formatDate(training.trainingDate)} /><Info icon={<Dumbbell size={15} />} value={`${training.exerciseCount} exercises · MC ${training.microcycleNumber} · TU ${training.trainingUnitNumber}`} /><Info icon={<Users size={15} />} value={`${training.participantCount} players · ${training.playerActionCount} actions`} /><Info icon={<Radio size={15} />} value={training.liveStatus === "LIVE" ? "Live recording in progress" : training.liveStatus === "ENDED" ? "Recording ready for review" : "Live session not started"} /></div>
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 bg-black/10 p-3"><Link href={`/live/${training.id}`} className="min-w-0 flex-1"><Button variant="primary" className="w-full"><Play size={16} />Open Live Training</Button></Link><Button size="icon" aria-label="Edit training" onClick={() => void openEdit(training.id)}><Pencil size={16} /></Button><Button variant="danger" size="icon" aria-label="Delete training" onClick={() => void removeTraining(training)}><Trash2 size={16} /></Button></div>
          </Panel>
        ))}
      </section>

      {editingTraining ? <TrainingEditDialog training={editingTraining} onSave={saveTraining} onDelete={() => removeTraining(editingTraining)} onClose={() => setEditingTraining(null)} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Panel className="p-4"><p className="text-xs uppercase tracking-[.2em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></Panel>;
}

function Info({ icon, value }: { icon: React.ReactNode; value: string }) {
  return <div className="flex min-w-0 items-center gap-2"><span className="text-cyan-200/80">{icon}</span><span className="truncate">{value}</span></div>;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) : "Date not set";
}
