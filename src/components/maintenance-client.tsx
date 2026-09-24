"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button, Input, Label, Panel } from "@/components/ui";
import type { MaintenanceRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

type Resource = "seasons" | "players";
const tabs: Array<{ key: Resource; label: string; singular: string }> = [
  { key: "seasons", label: "Seasons", singular: "season" },
  { key: "players", label: "Players", singular: "player" },
];
const emptyForm = { name: "", startDate: "", endDate: "", shirtNumber: "", position: "", active: true };

export function MaintenanceClient() {
  const [resource, setResource] = useState<Resource>("seasons");
  const [items, setItems] = useState<MaintenanceRecord[]>([]);
  const [editing, setEditing] = useState<MaintenanceRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const current = tabs.find((tab) => tab.key === resource)!;

  const load = useCallback(async () => { setItems(await apiFetch<MaintenanceRecord[]>(`/api/maintenance/${resource}`)); }, [resource]);
  useEffect(() => { setEditing(null); setForm(emptyForm); setError(""); setLoading(true); load().catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false)); }, [load]);

  function edit(item: MaintenanceRecord) {
    setEditing(item);
    setForm({ name: item.name, startDate: item.startDate?.slice(0, 10) || "", endDate: item.endDate?.slice(0, 10) || "", shirtNumber: item.shirtNumber === null || item.shirtNumber === undefined ? "" : String(item.shirtNumber), position: item.position || "", active: item.active !== false });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await apiFetch(`/api/maintenance/${resource}${editing ? `/${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) }); setEditing(null); setForm(emptyForm); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the record."); }
    finally { setSaving(false); }
  }

  async function remove(item: MaintenanceRecord) {
    if (!confirm(`Delete “${item.name}”?`)) return;
    setError("");
    try { await apiFetch(`/api/maintenance/${resource}/${item.id}`, { method: "DELETE" }); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete the record."); }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Configuration</p><h1 className="mt-2 text-3xl font-bold text-white">Maintenance</h1><p className="mt-2 text-sm text-slate-400">Manage seasons and the training squad.</p></div><a href="/api/backup" download><Button><Download size={15} />Download data backup</Button></a></div>
    <div className="flex gap-2">{tabs.map((tab) => <Button key={tab.key} variant={resource === tab.key ? "primary" : "secondary"} onClick={() => setResource(tab.key)}>{tab.label}</Button>)}</div>
    {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
    {loading ? <div className="flex min-h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading maintenance data…</div> : <div className="grid gap-5 lg:grid-cols-[25rem_minmax(0,1fr)]">
      <Panel className="p-5"><h2 className="mb-4 font-bold text-white">{editing ? "Edit" : "Add"} {current.singular}</h2><form className="grid gap-4" onSubmit={submit}>
        <label className="grid gap-2"><Label>Name</Label><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
        {resource === "seasons" ? <><label className="grid gap-2"><Label>Start date</Label><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label className="grid gap-2"><Label>End date</Label><Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></> : <><label className="grid gap-2"><Label>Shirt number</Label><Input type="number" min="0" max="999" step="1" value={form.shirtNumber} onChange={(event) => setForm({ ...form, shirtNumber: event.target.value })} /></label><label className="grid gap-2"><Label>Position</Label><Input value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></label><label className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4 accent-cyan-300" />Available for new trainings</label></>}
        <div className="flex gap-2"><Button variant="primary" disabled={saving}><Plus size={16} />{saving ? "Saving…" : editing ? "Save" : "Add"}</Button>{editing ? <Button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button> : null}</div>
      </form></Panel>
      <Panel className="divide-y divide-white/10 overflow-hidden">{items.length === 0 ? <p className="p-6 text-sm text-slate-400">There are no records yet.</p> : items.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div className="min-w-0"><p className="truncate font-semibold text-white">{resource === "players" && item.shirtNumber !== null && item.shirtNumber !== undefined ? `${item.shirtNumber} · ` : ""}{item.name}</p><p className="mt-1 text-xs text-slate-500">{resource === "seasons" ? `${item.startDate?.slice(0, 10) || "—"} — ${item.endDate?.slice(0, 10) || "—"}` : `${item.position || "Position not set"} · ${item.active === false ? "Inactive" : "Active"}`}</p></div><div className="flex gap-1"><Button size="icon" onClick={() => edit(item)} aria-label="Edit"><Pencil size={15} /></Button><Button size="icon" variant="danger" onClick={() => void remove(item)} aria-label="Delete"><Trash2 size={15} /></Button></div></div>)}</Panel>
    </div>}
  </div>;
}
