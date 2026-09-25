"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CheckSquare, ChevronsRight, Download, FileVideo, Loader2, Pause, Play, RotateCcw, Square, Upload, X } from "lucide-react";

import { Badge, Button, Label, Panel, Select } from "@/components/ui";
import { useVideoKeyboardSeek, VideoFullscreenButton } from "@/components/video-controls";
import type { AccountPayload, MomentRecord, PlayerActionRecord, SettingsPayload, TrainingDetail, TrainingSummary } from "@/lib/domain";
import { isExportPickerCancellation, pickExportDirectory, writeBlobToDirectory, writeUrlToDirectory } from "@/lib/export-directory";
import { saveFullVideo } from "@/lib/full-video-download";
import { apiFetch } from "@/lib/http";
import { getRememberedTrainingVideo, getRememberedTrainingVideoParts, rememberTrainingVideo, rememberTrainingVideoPart } from "@/lib/local-video-store";
import { getRemoteVideoUrl } from "@/lib/remote-video-store";
import { SmartVideoExportSession } from "@/lib/smart-video-export";
import { formatTime } from "@/lib/time";
import { downloadBlob, exportQualityOptions, type ExportQuality } from "@/lib/video-export";

type ClipKind = "all" | "moment" | "player";

type ReportClip = {
  key: string;
  kind: Exclude<ClipKind, "all">;
  training: TrainingDetail;
  id: string;
  label: string;
  detail: string;
  color: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  exerciseNumber: number | null;
  moment: MomentRecord;
};

type PlayingClip = {
  clip: ReportClip;
  url: string;
  mediaStart: number;
  mediaEnd: number;
  timelineOffset: number;
};

export function ReportsClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fullFilesRef = useRef(new Map<string, File>());
  const remoteUrlsRef = useRef(new Map<string, string>());
  const autoPlayRef = useRef(false);
  const playlistRef = useRef(false);
  const advancingRef = useRef(false);
  const playRequestRef = useRef(0);

  const [trainings, setTrainings] = useState<TrainingSummary[]>([]);
  const [details, setDetails] = useState<TrainingDetail[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [kind, setKind] = useState<ClipKind>("all");
  const [momentTypeId, setMomentTypeId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [selectedClipKeys, setSelectedClipKeys] = useState<string[]>([]);
  const [playing, setPlaying] = useState<PlayingClip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("Team");

  useEffect(() => {
    Promise.all([
      apiFetch<TrainingSummary[]>("/api/trainings"),
      apiFetch<SettingsPayload>("/api/settings"),
      apiFetch<AccountPayload>("/api/account"),
    ]).then(([rows, config, account]) => {
      setTrainings(rows);
      setSettings(config);
      setTeamName(account.teamName || "Team");
      if (rows[0]) setSelectedIds([rows[0].id]);
    }).catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!selectedIds.length) {
      setDetails([]);
      return;
    }
    setLoadingDetails(true);
    Promise.all(selectedIds.map((id) => apiFetch<TrainingDetail>(`/api/trainings/${id}`)))
      .then((rows) => { if (!cancelled) setDetails(rows); })
      .catch((error: Error) => setNotice(error.message))
      .finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [selectedIds]);

  useEffect(() => () => {
    playRequestRef.current += 1;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const availablePlayers = useMemo(() => {
    const players = new Map<string, TrainingDetail["participants"][number]["player"]>();
    for (const training of details) {
      for (const participant of training.participants) players.set(participant.player.id, participant.player);
    }
    return [...players.values()].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.name.localeCompare(b.name));
  }, [details]);

  const clips = useMemo<ReportClip[]>(() => {
    const rows: ReportClip[] = [];
    for (const training of details) {
      if (kind !== "player" && !playerId) {
        for (const moment of training.moments) {
          if (momentTypeId && moment.momentTypeId !== momentTypeId) continue;
          rows.push({
            key: `moment:${moment.id}`,
            kind: "moment",
            training,
            id: moment.id,
            label: moment.momentType.name,
            detail: "Collective moment",
            color: moment.momentType.color,
            startTimeSeconds: moment.startTimeSeconds,
            endTimeSeconds: moment.endTimeSeconds,
            durationSeconds: moment.durationSeconds,
            exerciseNumber: moment.exercise?.number ?? null,
            moment,
          });
        }
      }
      if (kind !== "moment" && !momentTypeId) {
        for (const action of training.playerActions) {
          if (playerId && action.playerId !== playerId) continue;
          rows.push(playerActionClip(training, action));
        }
      }
    }
    return rows.sort((a, b) => Date.parse(b.training.trainingDate) - Date.parse(a.training.trainingDate) || a.startTimeSeconds - b.startTimeSeconds);
  }, [details, kind, momentTypeId, playerId]);

  const selectedClips = useMemo(() => clips.filter((clip) => selectedClipKeys.includes(clip.key)), [clips, selectedClipKeys]);
  const totalDuration = clips.reduce((sum, clip) => sum + clip.durationSeconds, 0);

  useEffect(() => {
    setSelectedClipKeys((current) => current.filter((key) => clips.some((clip) => clip.key === key)));
  }, [clips]);

  useEffect(() => {
    if (!playing || clips.some((clip) => clip.key === playing.clip.key)) return;
    stopPlaylist();
    setPlaying(null);
  }, [clips, playing]);

  function toggleTraining(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleClip(key: string) {
    setSelectedClipKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function stopPlaylist() {
    playlistRef.current = false;
    advancingRef.current = false;
    autoPlayRef.current = false;
    playRequestRef.current += 1;
    videoRef.current?.pause();
  }

  async function getRemoteUrl(trainingId: string) {
    const cached = remoteUrlsRef.current.get(trainingId);
    if (cached) return cached;
    const remote = await getRemoteVideoUrl(trainingId);
    remoteUrlsRef.current.set(trainingId, remote.url);
    return remote.url;
  }

  async function resolveClipSource(clip: ReportClip) {
    const parts = await getRememberedTrainingVideoParts(clip.training.id).catch(() => []);
    const part = parts.find((item) => clip.startTimeSeconds >= item.startTimeSeconds - 0.05 && clip.endTimeSeconds <= item.startTimeSeconds + item.durationSeconds + 0.05);
    if (part) {
      const start = Math.max(0, clip.startTimeSeconds - part.startTimeSeconds);
      const end = Math.max(start + 0.1, clip.endTimeSeconds - part.startTimeSeconds);
      return { source: part.file as File | string, mediaStart: start, mediaEnd: end, timelineOffset: part.startTimeSeconds, moment: { ...clip.moment, startTimeSeconds: start, endTimeSeconds: end, durationSeconds: end - start } };
    }
    const local = fullFilesRef.current.get(clip.training.id) || await getRememberedTrainingVideo(clip.training.id).catch(() => null);
    if (local) {
      fullFilesRef.current.set(clip.training.id, local);
      return { source: local as File | string, mediaStart: clip.startTimeSeconds, mediaEnd: clip.endTimeSeconds, timelineOffset: 0, moment: clip.moment };
    }
    if (clip.training.video?.storageStatus === "READY") {
      const url = await getRemoteUrl(clip.training.id);
      return { source: url as File | string, mediaStart: clip.startTimeSeconds, mediaEnd: clip.endTimeSeconds, timelineOffset: 0, moment: clip.moment };
    }
    return null;
  }

  async function playClip(clip: ReportClip, fromPlaylist = false) {
    autoPlayRef.current = true;
    playlistRef.current = fromPlaylist;
    if (!fromPlaylist) advancingRef.current = false;
    if (playing?.clip.key === clip.key && videoRef.current) {
      videoRef.current.currentTime = playing.mediaStart;
      await videoRef.current.play();
      return;
    }
    const request = ++playRequestRef.current;
    const resolved = await resolveClipSource(clip).catch(() => null);
    if (request !== playRequestRef.current) return;
    if (!resolved) {
      playlistRef.current = false;
      setNotice(`The video for “${clip.training.title}” is not available. Load its local recording or upload it to the shared library.`);
      return;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    const url = typeof resolved.source === "string" ? resolved.source : URL.createObjectURL(resolved.source);
    if (typeof resolved.source !== "string") objectUrlRef.current = url;
    setPlaying({ clip, url, mediaStart: resolved.mediaStart, mediaEnd: resolved.mediaEnd, timelineOffset: resolved.timelineOffset });
    setNotice(null);
  }

  function playAll() {
    if (!clips.length) return;
    playlistRef.current = true;
    void playClip(clips[0], true);
  }

  function finishClip(video: HTMLVideoElement) {
    if (!playing || advancingRef.current || video.currentTime < playing.mediaEnd - 0.04) return;
    advancingRef.current = true;
    video.pause();
    video.currentTime = playing.mediaEnd;
    const index = clips.findIndex((clip) => clip.key === playing.clip.key);
    if (playlistRef.current && index >= 0 && index < clips.length - 1) {
      void playClip(clips[index + 1], true).finally(() => { advancingRef.current = false; });
    } else {
      playlistRef.current = false;
      advancingRef.current = false;
    }
  }

  function seekTo(seconds: number) {
    const video = videoRef.current;
    if (!video || !playing) return;
    const next = Math.max(playing.mediaStart, Math.min(playing.mediaEnd, seconds));
    video.currentTime = next;
    setCurrentTime(next);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !playing) return;
    if (!video.paused) {
      playlistRef.current = false;
      video.pause();
      return;
    }
    if (video.currentTime < playing.mediaStart || video.currentTime >= playing.mediaEnd) video.currentTime = playing.mediaStart;
    void video.play();
  }

  function setRate(rate: number) {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }

  useVideoKeyboardSeek(videoRef, seekTo, Boolean(playing));

  async function addLocalVideos(list: FileList | null) {
    if (!list?.length) return;
    let matched = 0;
    const unmatched: string[] = [];
    for (const file of Array.from(list)) {
      let assigned = false;
      for (const training of details) {
        const partMatch = file.name.match(/-Exercise-(\d+)-/i);
        if (partMatch && file.name.toLowerCase().startsWith(localRecordingPrefix(training.title).toLowerCase())) {
          const number = Number(partMatch[1]);
          const exercise = training.exercises.find((item) => item.number === number);
          if (exercise) {
            await rememberTrainingVideoPart({
              trainingId: training.id,
              partNumber: number,
              startTimeSeconds: exercise.startTimeSeconds,
              durationSeconds: Math.max(0.1, (exercise.endTimeSeconds ?? exercise.startTimeSeconds + 0.1) - exercise.startTimeSeconds),
              fileName: file.name,
              file,
            }).catch(() => undefined);
            assigned = true;
          }
        }
        if (!assigned && training.video?.fileName.toLowerCase() === file.name.toLowerCase()) {
          fullFilesRef.current.set(training.id, file);
          await rememberTrainingVideo(training.id, file).catch(() => undefined);
          assigned = true;
        }
        if (assigned) break;
      }
      if (!assigned && details.length === 1 && list.length === 1) {
        fullFilesRef.current.set(details[0].id, file);
        await rememberTrainingVideo(details[0].id, file).catch(() => undefined);
        assigned = true;
      }
      if (assigned) matched += 1;
      else unmatched.push(file.name);
    }
    setNotice(unmatched.length ? `${matched} file(s) loaded. Could not match: ${unmatched.join(", ")}.` : `${matched} local video file(s) ready.`);
  }

  async function exportSelectedClips() {
    if (!selectedClips.length || exporting) return;
    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (error) {
      if (isExportPickerCancellation(error)) return;
      return setNotice(error instanceof Error ? error.message : "Could not open the export folder.");
    }
    setExporting(true);
    setNotice(null);
    const root = `${safeName(teamName)}-training-report-${selectedClips.length}-clips`;
    const archive = directory ? null : new (await import("jszip")).default();
    const indexRows = [["training", "type", "label", "exercise", "start", "end", "file"]];
    let completed = 0;
    try {
      for (const clip of selectedClips) {
        const resolved = await resolveClipSource(clip);
        if (!resolved) throw new Error(`The video for “${clip.training.title}” is not available.`);
        const fallbackUrl = typeof resolved.source === "string" ? resolved.source : URL.createObjectURL(resolved.source);
        const ownsUrl = typeof resolved.source !== "string";
        const session = new SmartVideoExportSession(resolved.source);
        try {
          completed += 1;
          setStatus(`Exporting ${completed} of ${selectedClips.length}: ${clip.label}`);
          const result = await session.exportMoment({
            training: clip.training,
            moment: resolved.moment,
            quality,
            sourceUrlFallback: fallbackUrl,
            onStatus: (message) => setStatus(`${completed} of ${selectedClips.length}: ${message}`),
          });
          const folder = clip.kind === "moment" ? `Collective moments/${safeName(clip.label)}` : `Player actions/${safeName(clip.label)}`;
          const fileName = `${String(completed).padStart(3, "0")}-${result.fileName}`;
          const path = `${folder}/${fileName}`;
          if (directory) await writeBlobToDirectory(directory, `${root}/${path}`, result.blob);
          else archive?.file(`${root}/${path}`, result.blob);
          indexRows.push([clip.training.title, clip.kind, clip.label, String(clip.exerciseNumber ?? ""), String(clip.startTimeSeconds), String(clip.endTimeSeconds), path]);
        } finally {
          session.dispose();
          if (ownsUrl) URL.revokeObjectURL(fallbackUrl);
        }
      }
      const csv = new Blob([toCsv(indexRows)], { type: "text/csv;charset=utf-8" });
      if (directory) await writeBlobToDirectory(directory, `${root}/report-index.csv`, csv);
      else {
        archive?.file(`${root}/report-index.csv`, csv);
        setStatus("Creating the ZIP file…");
        const blob = await archive!.generateAsync({ type: "blob", compression: "STORE", streamFiles: true }, (metadata) => setStatus(`Creating ZIP: ${Math.round(metadata.percent)}%`));
        downloadBlob(blob, `${root}.zip`);
      }
      setNotice(`${completed} selected clips exported successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export the selected clips.");
    } finally {
      setExporting(false);
      setStatus("");
    }
  }

  async function exportFullTrainings() {
    if (!details.length || exporting) return;
    let directory = null;
    try {
      directory = await pickExportDirectory();
    } catch (error) {
      if (isExportPickerCancellation(error)) return;
      return setNotice(error instanceof Error ? error.message : "Could not open the export folder.");
    }
    setExporting(true);
    setNotice(null);
    const root = `${safeName(teamName)}-full-trainings`;
    let exported = 0;
    try {
      for (const training of details) {
        setStatus(`Exporting full training: ${training.title}`);
        const parts = await getRememberedTrainingVideoParts(training.id).catch(() => []);
        if (parts.length) {
          for (const part of parts) {
            if (directory) await writeBlobToDirectory(directory, `${root}/${safeName(training.title)}/${part.fileName}`, part.file);
            else downloadBlob(part.file, part.fileName);
            exported += 1;
          }
          continue;
        }
        const local = fullFilesRef.current.get(training.id) || await getRememberedTrainingVideo(training.id).catch(() => null);
        const fileName = local?.name || training.video?.fileName || `${safeName(training.title)}.mp4`;
        if (local) {
          if (directory) await writeBlobToDirectory(directory, `${root}/${safeName(training.title)}/${fileName}`, local);
          else downloadBlob(local, fileName);
          exported += 1;
          continue;
        }
        if (training.video?.storageStatus === "READY") {
          const remoteUrl = await getRemoteUrl(training.id);
          if (directory) await writeUrlToDirectory(directory, `${root}/${safeName(training.title)}/${fileName}`, remoteUrl);
          else await saveFullVideo({ remoteUrl, fileName, mimeType: training.video.mimeType });
          exported += 1;
          continue;
        }
        throw new Error(`The complete recording for “${training.title}” is not available. Load its local files first.`);
      }
      setNotice(`${details.length} full training${details.length === 1 ? "" : "s"} exported (${exported} video file${exported === 1 ? "" : "s"}).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not export the full training videos.");
    } finally {
      setExporting(false);
      setStatus("");
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-slate-400"><Loader2 className="mr-2 animate-spin" />Loading reports…</div>;

  const timelineTime = playing ? currentTime + playing.timelineOffset : currentTime;

  return <div className="flex min-h-0 flex-col gap-2 xl:h-[calc(100dvh-6.5rem)] xl:overflow-hidden">
    {notice ? <div className="flex shrink-0 items-center justify-between rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs text-cyan-50"><span>{notice}</span><button onClick={() => setNotice(null)}><X size={15} /></button></div> : null}
    {exporting ? <div className="flex shrink-0 items-center gap-2 rounded-lg border border-leaf-400/25 bg-leaf-400/10 px-3 py-2 text-xs text-emerald-100"><Loader2 size={15} className="animate-spin" />{status}</div> : null}

    <Panel className="grid shrink-0 gap-2 p-3 md:grid-cols-2 xl:grid-cols-[10rem_1fr_1fr_11rem_auto]">
      <label className="grid gap-1"><Label>Show</Label><Select value={kind} onChange={(event) => { const next = event.target.value as ClipKind; setKind(next); if (next === "moment") setPlayerId(""); if (next === "player") setMomentTypeId(""); }}><option value="all">All clips</option><option value="moment">Collective moments</option><option value="player">Player actions</option></Select></label>
      <label className="grid gap-1"><Label>Moment</Label><Select value={momentTypeId} onChange={(event) => { setMomentTypeId(event.target.value); setPlayerId(""); if (event.target.value) setKind("moment"); }}><option value="">All moments</option>{settings?.momentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></label>
      <label className="grid gap-1"><Label>Player</Label><Select value={playerId} onChange={(event) => { setPlayerId(event.target.value); setMomentTypeId(""); if (event.target.value) setKind("player"); }}><option value="">All players</option>{availablePlayers.map((player) => <option key={player.id} value={player.id}>{player.shirtNumber !== null ? `${player.shirtNumber} · ` : ""}{player.name}</option>)}</Select></label>
      <label className="grid gap-1"><Label>Export quality</Label><Select value={quality} onChange={(event) => setQuality(event.target.value as ExportQuality)}>{exportQualityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></label>
      <div className="flex items-end gap-2"><Metric label="Clips" value={clips.length} /><Metric label="Duration" value={formatTime(totalDuration)} /></div>
    </Panel>

    <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <Panel className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 gap-1 border-b border-white/10 p-2"><Button size="sm" onClick={() => setSelectedIds(trainings.map((training) => training.id))}><CheckSquare size={13} />All</Button><Button size="sm" onClick={() => setSelectedIds([])}>Clear</Button></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{trainings.map((training) => <button key={training.id} onClick={() => toggleTraining(training.id)} className={`flex w-full items-start gap-2 border-b border-white/[.06] p-2.5 text-left hover:bg-white/[.06] ${selectedIds.includes(training.id) ? "bg-leaf-400/10" : ""}`}>{selectedIds.includes(training.id) ? <CheckSquare size={15} className="mt-0.5 shrink-0 text-leaf-400" /> : <Square size={15} className="mt-0.5 shrink-0 text-slate-600" />}<span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{training.title}</span><span className="block text-[10px] text-slate-500">{new Date(training.trainingDate).toLocaleDateString("en-GB")} · {training.momentCount + training.playerActionCount} clips</span></span></button>)}</div>
      </Panel>

      <div className="flex min-h-0 flex-col gap-2">
        <Panel className="flex shrink-0 flex-wrap items-center justify-between gap-2 p-2.5"><div><p className="text-sm font-semibold text-white">{loadingDetails ? "Loading clips…" : `${clips.length} filtered clips`}</p><p className="text-[10px] text-slate-500">{selectedClipKeys.length} selected for export · {selectedIds.length} training{selectedIds.length === 1 ? "" : "s"}</p></div><div className="flex flex-wrap gap-1.5"><Button size="sm" disabled={!clips.length} onClick={() => setSelectedClipKeys(clips.map((clip) => clip.key))}><CheckSquare size={13} />Select clips</Button><Button size="sm" disabled={!selectedClipKeys.length} onClick={() => setSelectedClipKeys([])}>Clear clips</Button><Button size="sm" variant="primary" disabled={!clips.length} onClick={playAll}><Play size={13} />Play all</Button><label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/[.06] px-2.5 text-xs font-medium text-slate-100 hover:bg-white/[.11]"><Upload size={13} />Local videos<input type="file" accept="video/*" multiple className="hidden" onChange={(event) => { void addLocalVideos(event.target.files); event.currentTarget.value = ""; }} /></label><Button size="sm" disabled={!details.length || exporting} onClick={() => void exportFullTrainings()}><Download size={13} />Full training{details.length === 1 ? "" : "s"}</Button><Button size="sm" disabled={!selectedClips.length || exporting} onClick={() => void exportSelectedClips()}><Archive size={13} />Export clips ({selectedClips.length})</Button></div></Panel>

        <div ref={workspaceRef} data-video-workspace className={`reports-video-workspace grid min-h-0 flex-1 gap-2 ${playing ? "lg:grid-cols-[minmax(0,1fr)_22rem]" : ""}`}>
          {playing ? <Panel className="reports-video-panel flex min-h-0 flex-col overflow-hidden"><div className="reports-video-stage min-h-0 flex-1 bg-black"><video key={`${playing.url}-${playing.clip.key}`} ref={videoRef} src={playing.url} crossOrigin="anonymous" playsInline className="h-full w-full object-contain" onLoadedMetadata={(event) => { setVideoDuration(event.currentTarget.duration); setCurrentTime(playing.mediaStart); event.currentTarget.currentTime = playing.mediaStart; event.currentTarget.playbackRate = playbackRate; if (autoPlayRef.current) void event.currentTarget.play(); }} onTimeUpdate={(event) => { setCurrentTime(event.currentTarget.currentTime); finishClip(event.currentTarget); }} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} /></div><div className="shrink-0 border-t border-white/10 p-2"><input aria-label="Clip position" type="range" min={playing.mediaStart} max={Math.min(videoDuration || playing.mediaEnd, playing.mediaEnd)} step={0.1} value={Math.max(playing.mediaStart, Math.min(currentTime, playing.mediaEnd))} onChange={(event) => seekTo(Number(event.target.value))} className="h-1.5 w-full cursor-pointer accent-cyan-300"/><div className="mt-1.5 flex items-center gap-1"><span className="mr-auto font-mono text-[10px] text-slate-300">{formatTime(timelineTime)} / {formatTime(playing.clip.endTimeSeconds)}</span><Button size="icon" className="h-7 w-7" onClick={() => seekTo(currentTime - 5)}><RotateCcw size={12}/></Button><Button size="icon" className="h-7 w-7" variant="primary" onClick={togglePlayback}>{isPlaying ? <Pause size={12}/> : <Play size={12}/>}</Button><Button size="icon" className="h-7 w-7" onClick={() => seekTo(currentTime + 5)}><ChevronsRight size={12}/></Button>{[1, 2, 4].map((rate) => <button key={rate} onClick={() => setRate(rate)} className={`h-7 min-w-8 rounded border border-white/10 px-1 text-[9px] ${playbackRate === rate ? "bg-cyan-300 text-slate-950" : "bg-white/[.04] text-slate-300"}`}>{rate}x</button>)}<VideoFullscreenButton targetRef={workspaceRef}/></div></div><div className="shrink-0 border-t border-white/10 px-3 py-2"><p className="truncate text-xs font-semibold text-white">{playing.clip.training.title} <span className="font-normal text-slate-500">· {playing.clip.label} · Ex. {playing.clip.exerciseNumber ?? "—"}</span></p></div></Panel> : null}

          <Panel className="reports-clip-list flex min-h-0 flex-col overflow-hidden"><div className="flex shrink-0 items-center justify-between border-b border-white/10 p-2.5"><div><Label>Clips</Label><p className="mt-0.5 text-[9px] text-slate-500">Click a row to play · checkbox selects for export</p></div><Badge>{selectedClips.length}/{clips.length}</Badge></div><div className="min-h-0 flex-1 overflow-y-auto">{clips.length ? clips.map((clip, index) => <div key={clip.key} className={`flex h-10 items-center gap-2 border-b border-white/[.06] px-2 hover:bg-white/[.05] ${playing?.clip.key === clip.key ? "bg-leaf-400/10" : ""}`}><input type="checkbox" checked={selectedClipKeys.includes(clip.key)} onChange={() => toggleClip(clip.key)} aria-label={`Select clip ${index + 1}`} className="h-3.5 w-3.5 shrink-0 accent-cyan-300"/><button type="button" onClick={() => void playClip(clip)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: clip.color }}/><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold text-white">{clip.label}</span><span className="block truncate text-[9px] text-slate-500">{clip.training.title} · {clip.detail}</span></span><span className="shrink-0 text-[9px] text-slate-500">Ex. {clip.exerciseNumber ?? "—"}</span><span className="w-20 shrink-0 text-right font-mono text-[9px] text-slate-300">{formatTime(clip.startTimeSeconds)}–{formatTime(clip.endTimeSeconds)}</span><Play size={11} className="shrink-0 text-cyan-300"/></button></div>) : <div className="flex h-full min-h-40 items-center justify-center p-8 text-center text-xs text-slate-500"><div><FileVideo className="mx-auto mb-2"/><p>{selectedIds.length ? "No clips match the current filters." : "Select one or more trainings."}</p></div></div>}</div></Panel>
        </div>
      </div>
    </div>
  </div>;
}

function playerActionClip(training: TrainingDetail, action: PlayerActionRecord): ReportClip {
  const number = action.player.shirtNumber;
  const momentType = {
    id: `player-${action.playerId}`,
    name: action.player.name,
    code: number !== null ? `P${number}` : "PLAYER",
    color: "#67e8f9",
    defaultShortcut: null,
    sortOrder: 0,
    active: true,
  };
  const moment: MomentRecord = {
    id: action.id,
    trainingId: action.trainingId,
    momentTypeId: momentType.id,
    exerciseId: action.exerciseId,
    startTimeSeconds: action.startTimeSeconds,
    endTimeSeconds: action.endTimeSeconds,
    durationSeconds: action.durationSeconds,
    notes: action.notes,
    outcome: action.outcome,
    createdByUserId: action.createdByUserId,
    liveSessionId: action.liveSessionId,
    markedAtSeconds: action.markedAtSeconds,
    leadSeconds: action.leadSeconds,
    capturedFromLive: action.capturedFromLive,
    createdBy: action.createdBy,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
    momentType,
    exercise: action.exercise,
  };
  return {
    key: `player:${action.id}`,
    kind: "player",
    training,
    id: action.id,
    label: `${number !== null ? `${number} · ` : ""}${action.player.name}`,
    detail: "Player action",
    color: "#67e8f9",
    startTimeSeconds: action.startTimeSeconds,
    endTimeSeconds: action.endTimeSeconds,
    durationSeconds: action.durationSeconds,
    exerciseNumber: action.exercise?.number ?? null,
    moment,
  };
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="min-w-20 rounded-md border border-white/10 bg-white/[.04] px-2 py-1.5"><p className="text-sm font-bold text-white">{value}</p><p className="text-[8px] uppercase tracking-wide text-slate-500">{label}</p></div>;
}

function localRecordingPrefix(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "live-training";
}

function safeName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim() || "Unnamed";
}

function toCsv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")).join("\r\n")}`;
}
