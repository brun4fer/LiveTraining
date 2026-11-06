import { randomUUID } from "node:crypto";

import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace, requireWorkspace } from "@/lib/auth";
import { serializePlannedExercise } from "@/lib/data-store";
import { createMediaObjectUploadUrl, deleteMediaObject } from "@/lib/media-r2";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function exerciseForWorkspace(trainingId: string, plannedExerciseId: string, workspaceId: string) {
  return prisma.plannedExercise.findFirstOrThrow({
    where: { id: plannedExerciseId, trainingId, training: { workspaceId } },
  });
}

export async function POST(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { workspace } = await requireManagementWorkspace();
    const { trainingId, plannedExerciseId } = await context.params;
    await exerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    const body = await request.json() as { fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    const fileName = String(body.fileName || "").trim();
    const fileSize = Number(body.fileSize);
    const mimeType = String(body.mimeType || "").toLowerCase();
    if (!fileName || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_IMAGE_SIZE) throw new Error("Select a JPG, PNG or WebP image up to 15 MB.");
    if (!IMAGE_TYPES.has(mimeType)) throw new Error("Exercise images must be JPG, PNG or WebP.");
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const storageKey = `workspaces/${workspace.id}/training-exercises/${trainingId}/${plannedExerciseId}/${randomUUID()}.${extension}`;
    return Response.json({ storageKey, uploadUrl: createMediaObjectUploadUrl(storageKey) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { workspace } = await requireManagementWorkspace();
    const { trainingId, plannedExerciseId } = await context.params;
    const exercise = await exerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    const body = await request.json() as { storageKey?: unknown; fileName?: unknown; fileSize?: unknown; mimeType?: unknown };
    const storageKey = String(body.storageKey || "");
    const expectedPrefix = `workspaces/${workspace.id}/training-exercises/${trainingId}/${plannedExerciseId}/`;
    const fileSize = Number(body.fileSize);
    const mimeType = String(body.mimeType || "").toLowerCase();
    if (!storageKey.startsWith(expectedPrefix) || !IMAGE_TYPES.has(mimeType) || !Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_IMAGE_SIZE) throw new Error("Invalid exercise image confirmation.");
    const saved = await prisma.plannedExercise.update({
      where: { id: exercise.id },
      data: { imageStorageKey: storageKey, imageFileName: String(body.fileName || "exercise-image"), imageFileSize: fileSize, imageMimeType: mimeType },
    });
    if (exercise.imageStorageKey && exercise.imageStorageKey !== storageKey) await deleteMediaObject(exercise.imageStorageKey).catch(() => undefined);
    return Response.json(serializePlannedExercise(saved as unknown as Record<string, unknown>));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { workspace } = await requireManagementWorkspace();
    const { trainingId, plannedExerciseId } = await context.params;
    const exercise = await exerciseForWorkspace(trainingId, plannedExerciseId, workspace.id);
    const saved = await prisma.plannedExercise.update({ where: { id: exercise.id }, data: { imageStorageKey: null, imageFileName: null, imageFileSize: null, imageMimeType: null } });
    if (exercise.imageStorageKey) await deleteMediaObject(exercise.imageStorageKey).catch(() => undefined);
    return Response.json(serializePlannedExercise(saved as unknown as Record<string, unknown>));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ trainingId: string; plannedExerciseId: string }> }) {
  try {
    const { workspace } = await requireWorkspace();
    const { trainingId, plannedExerciseId } = await context.params;
    return Response.json(serializePlannedExercise(await exerciseForWorkspace(trainingId, plannedExerciseId, workspace.id) as unknown as Record<string, unknown>));
  } catch (error) {
    return handleApiError(error);
  }
}
