import type { PlannedExerciseRecord } from "@/lib/domain";
import { apiFetch } from "@/lib/http";

export async function uploadPlannedExerciseImage(trainingId: string, plannedExerciseId: string, file: File) {
  const prepared = await apiFetch<{ storageKey: string; uploadUrl: string }>(`/api/trainings/${trainingId}/planned-exercises/${plannedExerciseId}/image`, {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType: file.type }),
  });
  const uploaded = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploaded.ok) throw new Error(`Cloudflare R2 rejected the exercise image (HTTP ${uploaded.status}). Check the bucket CORS origin.`);
  return apiFetch<PlannedExerciseRecord>(`/api/trainings/${trainingId}/planned-exercises/${plannedExerciseId}/image`, {
    method: "PATCH",
    body: JSON.stringify({ storageKey: prepared.storageKey, fileName: file.name, fileSize: file.size, mimeType: file.type }),
  });
}
