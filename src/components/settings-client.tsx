"use client";

import { FormEvent, useEffect, useState } from "react";
import { Keyboard, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react";

import { Badge, Button, Input, Label, Panel } from "@/components/ui";
import { ManagementPasswordPanel } from "@/components/management-password-panel";
import { MediaLibraryLinkPanel } from "@/components/media-library-link-panel";
import { TeamAccessPanel } from "@/components/team-access-panel";
import type { MomentTypeRecord, SettingsPayload } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { isManagementPasswordEnabled } from "@/lib/management-access";

const emptyMoment = { name: "", code: "", color: "#2dd66f", defaultShortcut: "", active: true };

export function SettingsClient() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyMoment);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { apiFetch<SettingsPayload>("/api/settings").then(setSettings).catch((caught: Error) => setError(caught.message)).finally(() => setLoading(false)); }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); if (!settings) return; setError(null);
    try {
      const saved = await apiFetch<MomentTypeRecord>(`/api/settings/moment-types${editingId ? `/${editingId}` : ""}`, { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) });
      setSettings({ momentTypes: editingId ? settings.momentTypes.map((item) => item.id === saved.id ? saved : item) : [...settings.momentTypes, saved] });
      cancelEdit();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the moment type."); }
  }

  function edit(type: MomentTypeRecord) { setEditingId(type.id); setForm({ name: type.name, code: type.code, color: type.color, defaultShortcut: type.defaultShortcut || "", active: type.active }); }
  function cancelEdit() { setEditingId(null); setForm(emptyMoment); }

  async function remove(type: MomentTypeRecord) {
    if (!settings || !confirm(`Delete “${type.name}”?`)) return;
    try { await apiFetch(`/api/settings/moment-types/${type.id}`, { method: "DELETE" }); setSettings({ momentTypes: settings.momentTypes.filter((item) => item.id !== type.id) }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete this type."); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading settings…</div>;
  if (!settings) return <Panel className="p-4 text-red-100">{error}</Panel>;

  return <div className="space-y-5">
    <Panel className="p-5"><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Configuration</p><h1 className="mt-2 text-3xl font-bold text-white">Analysis settings</h1><p className="mt-2 text-sm text-slate-400">Configure the moment buttons and keyboard shortcuts used during every training.</p></Panel>
    {error ? <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
    {isManagementPasswordEnabled() ? <ManagementPasswordPanel /> : null}
    <TeamAccessPanel />
    <MediaLibraryLinkPanel />
    <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Panel className="overflow-hidden"><div className="flex items-center gap-2 border-b border-white/10 p-4"><Keyboard size={17} className="text-leaf-400" /><h2 className="font-bold text-white">Shortcuts</h2></div><div className="divide-y divide-white/[.06]">{settings.momentTypes.map((type) => <button key={type.id} type="button" onClick={() => edit(type)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[.05]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">{type.name}</span><kbd className="min-w-8 rounded-md border border-white/10 bg-black/20 px-2 py-1 text-center font-mono text-xs font-bold text-white">{type.defaultShortcut?.toUpperCase() || "—"}</kbd></button>)}</div></Panel>
      <Panel className="overflow-hidden"><div className="border-b border-white/10 p-4"><Label>Training moments</Label><p className="mt-1 text-xs text-slate-500">Each click saves the previous 20 seconds.</p></div><div className="divide-y divide-white/[.06]">{settings.momentTypes.map((type) => <div key={type.id} className="flex flex-wrap items-center gap-3 p-3"><span className="h-4 w-4 rounded-full" style={{ backgroundColor: type.color }} /><span className="min-w-44 flex-1"><span className="block text-sm font-semibold text-white">{type.name}</span><span className="text-xs text-slate-500">{type.code}</span></span>{type.defaultShortcut ? <Badge>{type.defaultShortcut}</Badge> : null}{!type.active ? <Badge>Inactive</Badge> : null}<Button size="sm" onClick={() => edit(type)}><Pencil size={14} />Edit</Button><Button size="sm" variant="danger" onClick={() => void remove(type)}><Trash2 size={14} />Delete</Button></div>)}</div>
        <form onSubmit={save} className="grid gap-3 border-t border-white/10 bg-black/10 p-4 sm:grid-cols-[minmax(12rem,1fr)_8rem_5rem_6rem_auto]"><Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Input placeholder="Code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required /><Input aria-label="Moment color" type="color" className="p-1" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /><Input maxLength={1} placeholder="Key" value={form.defaultShortcut} onChange={(event) => setForm({ ...form, defaultShortcut: event.target.value.slice(-1).toUpperCase() })} /><div className="flex gap-2"><Button variant="primary" size="icon" aria-label={editingId ? "Save" : "Add"}>{editingId ? <Save size={15} /> : <Plus size={15} />}</Button>{editingId ? <Button type="button" size="icon" onClick={cancelEdit}><X size={15} /></Button> : null}</div><label className="flex items-center gap-2 text-xs text-slate-300 sm:col-span-5"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="accent-cyan-300" />Visible during training</label></form>
      </Panel>
    </div>
  </div>;
}
