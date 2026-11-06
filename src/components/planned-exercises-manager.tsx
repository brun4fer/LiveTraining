"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, FileDown, ImagePlus, Loader2, Play, Plus, Save, Trash2, Upload, X } from "lucide-react";

import { Badge, Button, Input, Label, Panel, TextArea } from "@/components/ui";
import type { AccountPayload, PlannedExerciseRecord, TrainingDetail } from "@/lib/domain";
import { apiFetch } from "@/lib/http";
import { uploadPlannedExerciseImage } from "@/lib/planned-exercise-image";
import { getPlannedExerciseVideoUrl, uploadPlannedExerciseVideo } from "@/lib/remote-video-store";
import { exportTrainingPdf } from "@/lib/training-pdf";

export function PlannedExercisesManager({ trainingId }: { trainingId: string }) {
  const [training, setTraining] = useState<TrainingDetail | null>(null);
  const [teamName, setTeamName] = useState("Team");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingVideoId, setUploadingVideoId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const videoUploadAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    Promise.all([apiFetch<TrainingDetail>(`/api/trainings/${trainingId}`), apiFetch<AccountPayload>("/api/account")])
      .then(([detail, account]) => { setTraining(detail); setTeamName(account.teamName || "Team"); })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => setLoading(false));
  }, [trainingId]);

  function replacePlan(plan: PlannedExerciseRecord) {
    setTraining((current) => current ? { ...current, plannedExercises: current.plannedExercises.map((item) => item.id === plan.id ? plan : item) } : current);
  }

  async function addExercise() {
    setBusyId("new");
    try {
      const plan = await apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises`, { method: "POST", body: JSON.stringify({ name: `Exercise ${(training?.plannedExercises.length || 0) + 1}` }) });
      setTraining((current) => current ? { ...current, plannedExercises: [...current.plannedExercises, plan], plannedExerciseCount: current.plannedExerciseCount + 1 } : current);
      setNotice(`Exercise ${plan.number} added.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not add the exercise."); }
    finally { setBusyId(null); }
  }

  async function save(plan: PlannedExerciseRecord) {
    setBusyId(plan.id);
    try {
      replacePlan(await apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises/${plan.id}`, { method: "PATCH", body: JSON.stringify(plan) }));
      setNotice(`Exercise ${plan.number} saved.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save the exercise."); }
    finally { setBusyId(null); }
  }

  async function uploadImage(plan: PlannedExerciseRecord, file: File | null) {
    if (!file) return;
    setBusyId(plan.id);
    try {
      replacePlan(await uploadPlannedExerciseImage(trainingId, plan.id, file));
      setNotice(`Image for exercise ${plan.number} uploaded to the cloud.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not upload the exercise image."); }
    finally { setBusyId(null); }
  }

  async function removeImage(plan: PlannedExerciseRecord) {
    setBusyId(plan.id);
    try {
      replacePlan(await apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises/${plan.id}/image`, { method: "DELETE" }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the image."); }
    finally { setBusyId(null); }
  }

  async function remove(plan: PlannedExerciseRecord) {
    if (!window.confirm(`Delete exercise ${plan.number}: ${plan.name}?`)) return;
    setBusyId(plan.id);
    try {
      await apiFetch(`/api/trainings/${trainingId}/planned-exercises/${plan.id}`, { method: "DELETE" });
      const refreshed = await apiFetch<TrainingDetail>(`/api/trainings/${trainingId}`);
      setTraining(refreshed);
      setNotice("Exercise deleted and the remaining exercises were renumbered.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete the exercise."); }
    finally { setBusyId(null); }
  }

  async function uploadVideo(plan: PlannedExerciseRecord, file: File | null) {
    if (!file) return;
    const controller = new AbortController();
    videoUploadAbortRef.current = controller;
    setUploadingVideoId(plan.id);
    setVideoProgress(0);
    try {
      await uploadPlannedExerciseVideo(trainingId, plan.id, file, ({ progress, detail }) => {
        setVideoProgress(progress);
        setNotice(`${detail} ${Math.round(progress * 100)}%`);
      }, controller.signal);
      replacePlan(await apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises/${plan.id}`));
      setVideoUrls((current) => { const next = { ...current }; delete next[plan.id]; return next; });
      setNotice(`Video for exercise ${plan.number} uploaded successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not upload the exercise video.");
    } finally {
      if (videoUploadAbortRef.current === controller) videoUploadAbortRef.current = null;
      setUploadingVideoId(null);
      setVideoProgress(0);
    }
  }

  async function viewVideo(plan: PlannedExerciseRecord) {
    try {
      const playback = await getPlannedExerciseVideoUrl(trainingId, plan.id);
      setVideoUrls((current) => ({ ...current, [plan.id]: playback.url }));
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not open the exercise video."); }
  }

  async function removeVideo(plan: PlannedExerciseRecord) {
    if (!window.confirm(`Remove the video associated with exercise ${plan.number}? The cloud asset remains available in the shared library.`)) return;
    setBusyId(plan.id);
    try {
      await apiFetch(`/api/trainings/${trainingId}/planned-exercises/${plan.id}/video`, { method: "DELETE" });
      replacePlan(await apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises/${plan.id}`));
      setVideoUrls((current) => { const next = { ...current }; delete next[plan.id]; return next; });
      setNotice(`Video removed from exercise ${plan.number}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the exercise video."); }
    finally { setBusyId(null); }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading training plan…</div>;
  if (!training) return <Panel className="p-5 text-red-100">{notice || "Training not found."}</Panel>;

  return <div className="mx-auto max-w-6xl space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-white"><ArrowLeft size={13} />Back to trainings</Link><p className="mt-3 text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Training plan</p><h1 className="mt-1 text-2xl font-bold text-white">{training.title}</h1><p className="mt-1 text-sm text-slate-400">Prepare each exercise with its own image, description and independent video.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => { try { exportTrainingPdf(training, teamName); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not export the PDF."); } }}><FileDown size={15} />Export PDF</Button><Button variant="primary" onClick={() => void addExercise()} disabled={busyId !== null}><Plus size={15} />Add exercise</Button></div></div>
    {notice ? <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-50">{notice}</div> : null}
    <Panel className="grid grid-cols-2 gap-3 p-3 text-xs text-slate-400 sm:grid-cols-4"><div><Label>Date</Label><p className="mt-1 text-white">{new Date(training.trainingDate).toLocaleDateString("en-GB")}</p></div><div><Label>Season</Label><p className="mt-1 text-white">{training.season}</p></div><div><Label>Microcycle</Label><p className="mt-1 text-white">{training.microcycleNumber}</p></div><div><Label>Training unit</Label><p className="mt-1 text-white">{training.trainingUnitNumber}</p></div></Panel>
    {training.plannedExercises.length === 0 ? <Panel className="flex min-h-64 flex-col items-center justify-center p-6 text-center"><ImagePlus size={36} className="text-cyan-200" /><h2 className="mt-3 font-semibold text-white">No exercises planned</h2><p className="mt-1 text-sm text-slate-500">Add the first exercise, upload its image and write its description.</p><Button className="mt-4" variant="primary" onClick={() => void addExercise()}><Plus size={15} />Add exercise</Button></Panel> : <div className="grid gap-4">{training.plannedExercises.map((plan) => {
      const recorded = training.exercises.find((exercise) => exercise.plannedExerciseId === plan.id || (!exercise.plannedExerciseId && exercise.number === plan.number));
      return <Panel key={plan.id} className="grid overflow-hidden lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="relative flex min-h-60 items-center justify-center bg-black/30">
          {plan.imageUrl ? <Image unoptimized src={plan.imageUrl} alt={plan.name} fill className="object-contain" /> : <div className="text-center text-xs text-slate-500"><ImagePlus className="mx-auto mb-2 text-cyan-200" size={30} />No image</div>}
          <Badge className="absolute left-3 top-3 border-cyan-300/30 bg-pitch-950/90 text-cyan-100">Exercise {plan.number}</Badge>
        </div>
        <div className="grid content-start gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="grid gap-1"><Label>Name</Label><Input value={plan.name} onChange={(event) => replacePlan({ ...plan, name: event.target.value })} /></label>
          <label className="grid gap-1"><Label>Duration (min)</Label><Input type="number" min="1" step="1" value={plan.durationMinutes ?? ""} onChange={(event) => replacePlan({ ...plan, durationMinutes: event.target.value ? Number(event.target.value) : null })} /></label>
          <label className="grid gap-1 sm:col-span-2"><Label>Description</Label><TextArea className="min-h-28" value={plan.description || ""} onChange={(event) => replacePlan({ ...plan, description: event.target.value })} /></label>
          <div className="grid gap-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2"><div className="mr-auto"><Label>Exercise video</Label><p className="mt-1 text-xs text-slate-500">One independent cloud video for this exercise.</p></div>{plan.video ? <Badge className={plan.video.storageStatus === "READY" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" : ""}>{plan.video.storageStatus}</Badge> : null}</div>
            {videoUrls[plan.id] ? <video src={videoUrls[plan.id]} controls playsInline className="max-h-96 w-full rounded-md bg-black object-contain" /> : null}
            {plan.video ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400"><span className="truncate font-medium text-slate-200">{plan.video.fileName}</span><span>{formatBytes(plan.video.fileSize)}</span><span>{formatTime(plan.video.durationSeconds)}</span></div> : <p className="text-xs text-slate-500">No video uploaded for this exercise.</p>}
            {uploadingVideoId === plan.id ? <div className="grid gap-2"><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${Math.round(videoProgress * 100)}%` }} /></div><div className="flex items-center justify-between text-xs text-cyan-100"><span>{Math.round(videoProgress * 100)}%</span><Button size="sm" variant="danger" onClick={() => videoUploadAbortRef.current?.abort()}><X size={13} />Cancel upload</Button></div></div> : <div className="flex flex-wrap gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-cyan-300 px-3 text-xs font-semibold text-slate-950 hover:bg-cyan-200"><Upload size={14} />{plan.video ? "Replace video" : "Upload video"}<input type="file" accept="video/*" className="sr-only" onChange={(event) => { void uploadVideo(plan, event.target.files?.[0] || null); event.currentTarget.value = ""; }} /></label>{plan.video?.storageStatus === "READY" ? <Button size="sm" onClick={() => void viewVideo(plan)}><Play size={13} />{videoUrls[plan.id] ? "Refresh video" : "View video"}</Button> : null}{plan.video ? <Button size="sm" variant="danger" onClick={() => void removeVideo(plan)} disabled={busyId !== null}><Trash2 size={13} />Remove video</Button> : null}</div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/[.06] px-3 text-xs font-medium text-slate-100 hover:bg-white/[.11]"><Upload size={14} />{plan.imageUrl ? "Replace image" : "Upload image"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { void uploadImage(plan, event.target.files?.[0] || null); event.currentTarget.value = ""; }} /></label>{plan.imageUrl ? <Button size="sm" variant="danger" onClick={() => void removeImage(plan)} disabled={busyId === plan.id}>Remove image</Button> : null}<span className={`mr-auto text-xs ${recorded ? "text-emerald-300" : "text-slate-500"}`}>{recorded ? `Recorded ${formatTime(recorded.startTimeSeconds)}–${recorded.endTimeSeconds === null ? "live" : formatTime(recorded.endTimeSeconds)}` : "Not recorded"}</span><Button size="sm" variant="danger" onClick={() => void remove(plan)} disabled={busyId !== null || Boolean(recorded)}><Trash2 size={13} />Delete</Button><Button size="sm" variant="primary" onClick={() => void save(plan)} disabled={busyId !== null || !plan.name.trim()}>{busyId === plan.id ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save</Button></div>
        </div>
      </Panel>;
    })}</div>}
  </div>;
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.round(value));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}
