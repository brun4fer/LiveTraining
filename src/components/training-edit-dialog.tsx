"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";

import { Button, Input, Label, Panel, Select, TextArea } from "@/components/ui";
import type { MaintenanceRecord, TrainingDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export function TrainingEditDialog({ training, onSave, onDelete, onClose }: { training: TrainingDetail; onSave: (input: Record<string, unknown>) => Promise<void>; onDelete: () => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ seasonId: training.seasonId, microcycleNumber: String(training.microcycleNumber), trainingUnitNumber: String(training.trainingUnitNumber), trainingDate: training.trainingDate.slice(0, 10), notes: training.notes || "", participantIds: training.participants.map((item) => item.playerId) });
  const [seasons, setSeasons] = useState<MaintenanceRecord[]>([]);
  const [players, setPlayers] = useState<MaintenanceRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<MaintenanceRecord[]>("/api/maintenance/seasons"), apiFetch<MaintenanceRecord[]>("/api/maintenance/players")])
      .then(([seasonRows, playerRows]) => { setSeasons(seasonRows); setPlayers(playerRows); })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await onSave(form); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the training."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete “${training.title}”, its exercises, moments and player actions? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try { await onDelete(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete the training."); setBusy(false); }
  }

  function togglePlayer(id: string) {
    setForm((current) => ({ ...current, participantIds: current.participantIds.includes(id) ? current.participantIds.filter((playerId) => playerId !== id) : [...current.participantIds, id] }));
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true"><Panel className="my-6 w-full max-w-3xl p-5"><div className="flex items-center justify-between"><div><Label>Edit training</Label><h2 className="mt-1 text-xl font-bold text-white">{training.title}</h2></div><Button size="icon" variant="ghost" onClick={onClose}><X /></Button></div><form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={submit}>
    <label className="grid gap-2 md:col-span-2"><Label>Season</Label><Select required value={form.seasonId} onChange={(event) => setForm({ ...form, seasonId: event.target.value })}><option value="">Select…</option>{seasons.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
    <label className="grid gap-2"><Label>Microcycle</Label><Input type="number" min="1" step="1" required value={form.microcycleNumber} onChange={(event) => setForm({ ...form, microcycleNumber: event.target.value })} /></label>
    <label className="grid gap-2"><Label>Training unit</Label><Input type="number" min="1" step="1" required value={form.trainingUnitNumber} onChange={(event) => setForm({ ...form, trainingUnitNumber: event.target.value })} /></label>
    <label className="grid gap-2"><Label>Date</Label><Input type="date" required value={form.trainingDate} onChange={(event) => setForm({ ...form, trainingDate: event.target.value })} /></label>
    <label className="grid gap-2"><Label>Notes</Label><TextArea className="min-h-10" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
    <div className="md:col-span-2"><div className="mb-2 flex items-center justify-between"><Label>Participating players</Label><span className="text-xs text-slate-500">{form.participantIds.length} selected</span></div><div className="grid max-h-48 grid-cols-2 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-2 sm:grid-cols-3">{players.map((player) => <label key={player.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-200 hover:bg-white/[.05]"><input type="checkbox" checked={form.participantIds.includes(player.id)} onChange={() => togglePlayer(player.id)} className="accent-cyan-300" />{player.shirtNumber !== null && player.shirtNumber !== undefined ? `${player.shirtNumber} · ` : ""}{player.name}</label>)}</div></div>
    {error ? <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100 md:col-span-2">{error}</div> : null}
    <div className="flex flex-wrap justify-between gap-2 md:col-span-2"><Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}><Trash2 size={15} />Delete training</Button><div className="flex gap-2"><Button type="button" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={busy || form.participantIds.length === 0}>{busy ? "Saving…" : "Save changes"}</Button></div></div>
  </form></Panel></div>;
}
