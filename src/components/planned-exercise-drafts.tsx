"use client";

import { ImagePlus, Plus, Trash2 } from "lucide-react";
import Image from "next/image";

import { Button, Input, Label, TextArea } from "@/components/ui";

export type PlannedExerciseDraft = {
  key: string;
  name: string;
  description: string;
  durationMinutes: string;
  imageFile: File | null;
  imagePreview: string | null;
};

export function createPlannedExerciseDraft(index: number): PlannedExerciseDraft {
  return { key: crypto.randomUUID(), name: `Exercise ${index + 1}`, description: "", durationMinutes: "", imageFile: null, imagePreview: null };
}

export function PlannedExerciseDrafts({ exercises, onChange }: { exercises: PlannedExerciseDraft[]; onChange(exercises: PlannedExerciseDraft[]): void }) {
  function update(key: string, patch: Partial<PlannedExerciseDraft>) {
    onChange(exercises.map((exercise) => exercise.key === key ? { ...exercise, ...patch } : exercise));
  }

  function selectImage(exercise: PlannedExerciseDraft, file: File | null) {
    if (!file) return update(exercise.key, { imageFile: null, imagePreview: null });
    const reader = new FileReader();
    reader.onload = () => update(exercise.key, { imageFile: file, imagePreview: typeof reader.result === "string" ? reader.result : null });
    reader.readAsDataURL(file);
  }

  function remove(key: string) {
    onChange(exercises.filter((exercise) => exercise.key !== key).map((exercise, index) => ({ ...exercise, name: exercise.name === `Exercise ${index + 2}` ? `Exercise ${index + 1}` : exercise.name })));
  }

  return <section className="grid gap-3">
    <div className="flex items-center justify-between gap-3"><div><Label>Planned exercises</Label><p className="mt-1 text-xs text-slate-500">Add the image and description supplied by the coaching staff. Exercises can be recorded in any order.</p></div><Button type="button" size="sm" onClick={() => onChange([...exercises, createPlannedExerciseDraft(exercises.length)])}><Plus size={14} />Add exercise</Button></div>
    {exercises.length === 0 ? <div className="rounded-xl border border-dashed border-white/15 bg-black/10 p-6 text-center text-sm text-slate-500">No exercises added yet. You can also add them after creating the training.</div> : exercises.map((exercise, index) => <div key={exercise.key} className="grid gap-3 rounded-xl border border-white/10 bg-black/15 p-3 md:grid-cols-[12rem_minmax(0,1fr)]">
      <label className="relative flex min-h-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-white/15 bg-black/20 text-center hover:border-cyan-300/40">
        {exercise.imagePreview ? <Image unoptimized fill src={exercise.imagePreview} alt={`Exercise ${index + 1}`} className="object-contain" /> : <span className="flex flex-col items-center gap-2 px-3 text-xs text-slate-500"><ImagePlus size={24} className="text-cyan-200" />JPG, PNG or WebP<br />up to 15 MB</span>}
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(exercise, event.target.files?.[0] || null)} />
      </label>
      <div className="grid content-start gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
        <label className="grid gap-1"><Label>Exercise {index + 1}</Label><Input required value={exercise.name} onChange={(event) => update(exercise.key, { name: event.target.value })} placeholder={`Exercise ${index + 1}`} /></label>
        <label className="grid gap-1"><Label>Duration (min)</Label><Input type="number" min="1" step="1" value={exercise.durationMinutes} onChange={(event) => update(exercise.key, { durationMinutes: event.target.value })} placeholder="Optional" /></label>
        <Button type="button" size="icon" variant="danger" className="mt-5" title={`Remove exercise ${index + 1}`} onClick={() => remove(exercise.key)}><Trash2 size={14} /></Button>
        <label className="grid gap-1 sm:col-span-3"><Label>Description</Label><TextArea className="min-h-24" value={exercise.description} onChange={(event) => update(exercise.key, { description: event.target.value })} placeholder="Organization, objectives, rules and coaching points…" /></label>
      </div>
    </div>)}
  </section>;
}
