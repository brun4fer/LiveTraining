import { randomUUID } from "node:crypto";

import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace } from "@/lib/auth";
import { serializePlannedExercise } from "@/lib/data-store";
import { setMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { abortMediaMultipartUpload, createMediaMultipartUpload, listMediaMultipartParts } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { plannedExerciseForWorkspace, plannedExerciseVideoReferenceId } from "@/lib/planned-exercise-video";
import { prisma } from "@/lib/prisma";
import { inferVideoUploadPartSize, videoUploadPartSize } from "@/lib/video-upload";

const MAX_FILE_SIZE = 5 * 1024 ** 4 - 5 * 1024 ** 3;

export async function POST(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  let created: { id: string; key: string; uploadId: string } | null = null;
  try {
    const account = await requireManagementWorkspace();
    const { workspace } = account;
    const { appId, mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    const body = await request.json();
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
    const fileSize = Number(body.fileSize);
    const durationSeconds = Number(body.durationSeconds);
    const mimeType = typeof body.mimeType === "string" && body.mimeType.startsWith("video/") ? body.mimeType : "video/mp4";
    const lastModified = body.lastModified ? new Date(body.lastModified) : null;
    if (!fileName || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) throw new Error("Invalid video size.");
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("Invalid video duration.");
    if (lastModified && Number.isNaN(lastModified.getTime())) throw new Error("Invalid video modification date.");

    const exercise = await plannedExerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    const sameFile = exercise.videoFileName === fileName
      && Number(exercise.videoFileSize) === fileSize
      && exercise.videoLastModified?.getTime() === lastModified?.getTime();
    const partSize = videoUploadPartSize(fileSize);
    if (sameFile && exercise.videoStorageStatus === "READY" && exercise.videoMediaAssetId) {
      return Response.json({ exercise: serializePlannedExercise(exercise as unknown as Record<string, unknown>), uploadId: null, partSize, completedParts: [], alreadyReady: true });
    }
    if (sameFile && exercise.videoStorageStatus === "UPLOADING" && exercise.videoMediaAssetId) {
      const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id } });
      if (asset?.storageStatus === "UPLOADING" && asset.uploadId) {
        try {
          const completedParts = await listMediaMultipartParts(asset.storageKey, asset.uploadId);
          return Response.json({ exercise: serializePlannedExercise(exercise as unknown as Record<string, unknown>), uploadId: asset.uploadId, partSize: inferVideoUploadPartSize(fileSize, completedParts), completedParts, alreadyReady: false });
        } catch {
          await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "FAILED", uploadId: null } }).catch(() => undefined);
        }
      }
    }
    if (exercise.videoMediaAssetId) {
      const pending = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "UPLOADING" } });
      if (pending?.uploadId) {
        await abortMediaMultipartUpload(pending.storageKey, pending.uploadId).catch(() => undefined);
        await mediaPrisma.mediaAsset.update({ where: { id: pending.id }, data: { storageStatus: "FAILED", uploadId: null } }).catch(() => undefined);
      }
    }

    const assetId = randomUUID();
    const storageKey = `workspaces/${mediaWorkspace.id}/training-exercises/${plannedExerciseId}/${assetId}/video`;
    const uploadId = await createMediaMultipartUpload(storageKey, mimeType);
    created = { id: assetId, key: storageKey, uploadId };
    await mediaPrisma.mediaAsset.create({ data: {
      id: assetId, mediaWorkspaceId: mediaWorkspace.id, createdByAppId: appId, fileName, fileSize: BigInt(fileSize),
      durationSeconds, mimeType, lastModified, storageKey, storageStatus: "UPLOADING", uploadId,
    } });
    const saved = await prisma.plannedExercise.update({ where: { id: exercise.id }, data: {
      videoFileName: fileName, videoFileSize: BigInt(fileSize), videoDurationSeconds: durationSeconds, videoMimeType: mimeType,
      videoLastModified: lastModified, videoStorageStatus: "UPLOADING", videoMediaAssetId: assetId, videoEtag: null, videoUploadedAt: null,
    } });
    await setMediaReference({
      mediaWorkspaceId: mediaWorkspace.id, mediaAssetId: assetId, appId,
      externalVideoId: plannedExerciseVideoReferenceId(exercise.id), externalTrainingId: trainingId,
    });
    return Response.json({ exercise: serializePlannedExercise(saved as unknown as Record<string, unknown>), uploadId, partSize, completedParts: [], alreadyReady: false }, { status: 201 });
  } catch (error) {
    if (created) {
      await abortMediaMultipartUpload(created.key, created.uploadId).catch(() => undefined);
      await mediaPrisma.mediaAsset.updateMany({ where: { id: created.id }, data: { storageStatus: "FAILED", uploadId: null } }).catch(() => undefined);
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const account = await requireManagementWorkspace();
    const { workspace } = account;
    const { mediaWorkspace } = await ensureMediaWorkspace(account);
    const { trainingId, plannedExerciseId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const exercise = await plannedExerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    if (exercise.videoMediaAssetId) {
      const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: exercise.videoMediaAssetId, mediaWorkspaceId: mediaWorkspace.id, storageStatus: "UPLOADING" } });
      if (asset?.uploadId && (!body.uploadId || body.uploadId === asset.uploadId)) {
        await abortMediaMultipartUpload(asset.storageKey, asset.uploadId).catch(() => undefined);
        await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "FAILED", uploadId: null } });
        await prisma.plannedExercise.update({ where: { id: exercise.id }, data: { videoStorageStatus: "FAILED" } });
      }
    }
    return Response.json({ aborted: true });
  } catch (error) { return handleApiError(error); }
}
