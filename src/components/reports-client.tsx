"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Calendar, Dumbbell, Loader2, Users } from "lucide-react";

import { Badge, Label, Panel, Select } from "@/components/ui";
import type { AccountPayload, TrainingDetail, TrainingSummary } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { formatTime } from "@/lib/time";

export function ReportsClient() {
  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<TrainingDetail | null>(null);
  const [teamName, setTeamName] = useState("Team");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    Promise.all([apiFetch<TrainingSummary[]>("/api/trainings"), apiFetch<AccountPayload>("/api/account")])
      .then(([rows, account]) => { setTrainings(rows); setTeamName(account.teamName || "Team"); if (rows[0]) setSelectedId(rows[0].id); })
      .catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!selectedId) { setDetail(null); return; } setLoading(true); apiFetch<TrainingDetail>(`/api/trainings/${selectedId}`).then(setDetail).catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false)); }, [selectedId]);

  const momentCounts = useMemo(() => detail ? detail.moments.reduce<Record<string, { name: string; color: string; count: number }>>((counts, moment) => { const current = counts[moment.momentTypeId] || { name: moment.momentType.name, color: moment.momentType.color, count: 0 }; current.count += 1; counts[moment.momentTypeId] = current; return counts; }, {}) : {}, [detail]);
  const playerCounts = useMemo(() => detail ? detail.participants.map(({ player }) => ({ player, count: detail.playerActions.filter((action) => action.playerId === player.id).length })).sort((a, b) => b.count - a.count || a.player.name.localeCompare(b.player.name)) : [], [detail]);
  const playerActions = useMemo(() => detail ? [...detail.playerActions].sort((a, b) => b.endTimeSeconds - a.endTimeSeconds) : [], [detail]);

  if (loading && trainings.length === 0) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Preparing reports…</div>;

  return <div className="flex min-h-[calc(100vh-5.5rem)] flex-col gap-3 overflow-hidden">
    <Panel className="flex shrink-0 flex-wrap items-end justify-between gap-3 p-4"><div><p className="text-xs font-bold uppercase tracking-[.22em] text-leaf-400">Training intelligence</p><h1 className="mt-1 text-2xl font-bold text-white">{teamName} reports</h1><p className="mt-1 text-xs text-slate-400">Collective moments and individual player actions stay separate for faster reading.</p></div><label className="grid min-w-72 gap-1"><Label>Training</Label><Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Select…</option>{trainings.map((training) => <option key={training.id} value={training.id}>{training.title} · {new Date(training.trainingDate).toLocaleDateString("en-GB")}</option>)}</Select></label></Panel>
    {notice ? <div className="shrink-0 rounded-lg border border-red-400/25 bg-red-500/10 p-2 text-xs text-red-100">{notice}</div> : null}
    {!detail ? <Panel className="flex flex-1 items-center justify-center text-sm text-slate-500">Select a training to open its report.</Panel> : <>
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4"><Metric icon={<Calendar size={15} />} label="Training" value={new Date(detail.trainingDate).toLocaleDateString("en-GB")} /><Metric icon={<Dumbbell size={15} />} label="Exercises" value={String(detail.exerciseCount)} /><Metric icon={<BarChart3 size={15} />} label="Moments" value={String(detail.momentCount)} /><Metric icon={<Users size={15} />} label="Player actions" value={String(detail.playerActionCount)} /></div>
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
        <Panel className="flex min-h-0 flex-col overflow-hidden"><div className="flex shrink-0 items-center justify-between border-b border-white/10 p-3"><div><Label>Training moments</Label><p className="mt-1 text-[10px] text-slate-500">Collective analysis · 20 second clips</p></div><Badge>{detail.momentCount}</Badge></div><div className="grid shrink-0 grid-cols-2 gap-2 border-b border-white/10 p-2 sm:grid-cols-3">{Object.entries(momentCounts).map(([id, item]) => <div key={id} className="rounded-md border border-white/10 bg-white/[.03] p-2"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate text-[10px] text-slate-300">{item.name}</span></div><p className="mt-1 text-lg font-semibold text-white">{item.count}</p></div>)}</div><div className="min-h-0 flex-1 overflow-y-auto">{detail.moments.length === 0 ? <Empty text="No moments were marked." /> : detail.moments.map((moment, index) => <div key={moment.id} className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_5rem] items-center gap-2 border-b border-white/[.06] px-3 py-2 text-xs"><span className="font-mono text-slate-600">{index + 1}</span><span className="truncate text-slate-200"><span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: moment.momentType.color }} />{moment.momentType.name}</span><span className="text-slate-500">Ex. {moment.exercise?.number ?? "—"}</span><span className="text-right font-mono text-slate-400">{formatTime(moment.endTimeSeconds)}</span></div>)}</div></Panel>
        <Panel className="flex min-h-0 flex-col overflow-hidden"><div className="flex shrink-0 items-center justify-between border-b border-white/10 p-3"><div><Label>Player actions</Label><p className="mt-1 text-[10px] text-slate-500">Individual analysis · 15 second clips</p></div><Badge>{detail.playerActionCount}</Badge></div><div className="grid max-h-24 shrink-0 grid-cols-2 gap-1 overflow-y-auto border-b border-white/10 p-2 sm:grid-cols-3">{playerCounts.map(({ player, count }) => <div key={player.id} className="flex min-w-0 items-center justify-between gap-2 rounded border border-white/[.06] bg-white/[.02] px-2 py-1"><span className="truncate text-[10px] text-slate-300">{player.shirtNumber !== null ? `${player.shirtNumber} · ` : ""}{player.name}</span><span className="font-mono text-[10px] text-cyan-200">{count}</span></div>)}</div><div className="min-h-0 flex-1 overflow-y-auto"><div className="grid grid-cols-[minmax(0,1fr)_4rem_5rem] border-b border-white/10 px-3 py-2 text-[9px] uppercase tracking-wider text-slate-600"><span>Player</span><span>Exercise</span><span className="text-right">Clip ends</span></div>{playerActions.length === 0 ? <Empty text="No individual actions were marked." /> : playerActions.map((action) => <div key={action.id} className="grid grid-cols-[minmax(0,1fr)_4rem_5rem] items-center gap-2 border-b border-white/[.06] px-3 py-2 text-xs"><span className="truncate font-medium text-white">{action.player.shirtNumber !== null ? `${action.player.shirtNumber} · ` : ""}{action.player.name}</span><span className="text-slate-500">Ex. {action.exercise?.number ?? "—"}</span><span className="text-right font-mono text-slate-400">{formatTime(action.endTimeSeconds)}</span></div>)}</div></Panel>
      </div>
    </>}
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <Panel className="flex items-center gap-3 p-3"><span className="text-cyan-200">{icon}</span><div><p className="text-[9px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold text-white">{value}</p></div></Panel>; }
function Empty({ text }: { text: string }) { return <p className="p-5 text-center text-xs text-slate-500">{text}</p>; }
