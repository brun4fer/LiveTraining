import { mediaPrisma } from "@/lib/media-prisma";
import { createMediaPlaybackUrl } from "@/lib/media-r2";
import { prisma } from "@/lib/prisma";

export function plannedExerciseVideoReferenceId(plannedExerciseId: string) {
  return `planned-exercise:${plannedExerciseId}`;
}

export async function plannedExerciseForWorkspace(trainingId: string, plannedExerciseId: string, workspaceId: string) {
  return prisma.plannedExercise.findFirstOrThrow({
    where: { id: plannedExerciseId, trainingId, training: { workspaceId } },
  });
}

export async function plannedExerciseVideoPlaybackUrl(input: {
  trainingId: string;
  plannedExerciseId: string;
  workspaceId: string;
  mediaWorkspaceId: string;
}) {
  const exercise = await plannedExerciseForWorkspace(input.trainingId, input.plannedExerciseId, input.workspaceId);
  if (exercise.videoStorageStatus !== "READY" || !exercise.videoMediaAssetId) throw new Error("This exercise does not have a cloud video ready for playback.");
  const asset = await mediaPrisma.mediaAsset.findFirstOrThrow({
    where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: input.mediaWorkspaceId, storageStatus: "READY" },
  });
  return createMediaPlaybackUrl(asset.storageKey);
}
