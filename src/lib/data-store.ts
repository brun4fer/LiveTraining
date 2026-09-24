import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireManagementWorkspace, requireWorkspace } from "@/lib/auth";
import { removeMediaReference } from "@/lib/media-library";
import { mediaPrisma } from "@/lib/media-prisma";
import { abortMediaMultipartUpload } from "@/lib/media-r2";
import { ensureMediaWorkspace } from "@/lib/media-workspace";
import { abortMultipartUpload, deleteR2Object } from "@/lib/r2";
import { serializeVideo } from "@/lib/video";

export const trainingInclude = {
  video: true,
  moments: {
    include: {
      momentType: true,
      exercise: true,
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { startTimeSeconds: "asc" as const },
  },
  playerActions: {
    include: {
      player: true,
      exercise: true,
      createdBy: { select: { id: true, name: true, username: true } },
    },
    orderBy: { startTimeSeconds: "asc" as const },
  },
  exercises: { orderBy: { number: "asc" as const } },
  participants: {
    include: { player: true },
    orderBy: [{ sortOrder: "asc" as const }, { player: { name: "asc" as const } }],
  },
};

function serializeTraining(training: Record<string, unknown>) {
  const video = training.video as ({ fileSize: bigint } & Record<string, unknown>) | null | undefined;
  const moments = (training.moments as unknown[] | undefined) ?? [];
  const playerActions = (training.playerActions as unknown[] | undefined) ?? [];
  const exercises = (training.exercises as unknown[] | undefined) ?? [];
  const participants = (training.participants as unknown[] | undefined) ?? [];
  const trainingDate = training.trainingDate;
  return {
    ...training,
    trainingDate: trainingDate instanceof Date ? trainingDate.toISOString() : trainingDate,
    video: video ? serializeVideo(video) : null,
    momentCount: moments.length,
    playerActionCount: playerActions.length,
    exerciseCount: exercises.length,
    participantCount: participants.length,
  };
}

export async function listTrainings() {
  const { workspace } = await requireWorkspace();
  const rows = await prisma.training.findMany({
    where: { workspaceId: workspace.id },
    include: {
      video: true,
      liveSessions: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { moments: true, playerActions: true, exercises: true, participants: true } },
    },
    orderBy: [{ trainingDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((training) => ({
    id: training.id,
    title: training.title,
    season: training.season,
    seasonId: training.seasonId,
    microcycleNumber: training.microcycleNumber,
    trainingUnitNumber: training.trainingUnitNumber,
    trainingDate: training.trainingDate.toISOString(),
    video: training.video ? serializeVideo(training.video) : null,
    momentCount: training._count.moments,
    playerActionCount: training._count.playerActions,
    exerciseCount: training._count.exercises,
    participantCount: training._count.participants,
    liveStatus: training.liveSessions[0]?.status ?? null,
  }));
}

export async function getTraining(trainingId: string) {
  const { workspace } = await requireWorkspace();
  const training = await prisma.training.findFirstOrThrow({
    where: { id: trainingId, workspaceId: workspace.id },
    include: trainingInclude,
  });
  return serializeTraining(training as unknown as Record<string, unknown>);
}

export async function createTraining(input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  const seasonId = String(input.seasonId || "");
  const microcycleNumber = positiveInteger(input.microcycleNumber, "Microcycle");
  const trainingUnitNumber = positiveInteger(input.trainingUnitNumber, "Training unit");
  const trainingDate = validDate(input.trainingDate);
  const participantIds = stringArray(input.participantIds);
  if (!seasonId) throw new Error("Season is required.");
  if (participantIds.length === 0) throw new Error("Select at least one player for this training.");

  const [season, playerCount] = await Promise.all([
    prisma.season.findFirstOrThrow({ where: { id: seasonId, workspaceId: workspace.id } }),
    prisma.player.count({ where: { id: { in: participantIds }, workspaceId: workspace.id, active: true } }),
  ]);
  if (playerCount !== participantIds.length) throw new Error("One or more selected players are unavailable.");
  const title = `${season.name} · MC ${microcycleNumber} · TU ${trainingUnitNumber}`;

  const training = await prisma.training.create({
    data: {
      title,
      workspaceId: workspace.id,
      season: season.name,
      seasonId,
      microcycleNumber,
      trainingUnitNumber,
      trainingDate,
      notes: optionalString(input.notes),
      participants: {
        create: participantIds.map((playerId, sortOrder) => ({ playerId, sortOrder })),
      },
    },
    include: trainingInclude,
  });
  return serializeTraining(training as unknown as Record<string, unknown>);
}

export async function updateTraining(trainingId: string, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  const current = await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id } });
  const seasonId = input.seasonId === undefined ? current.seasonId : String(input.seasonId);
  const microcycleNumber = input.microcycleNumber === undefined ? current.microcycleNumber : positiveInteger(input.microcycleNumber, "Microcycle");
  const trainingUnitNumber = input.trainingUnitNumber === undefined ? current.trainingUnitNumber : positiveInteger(input.trainingUnitNumber, "Training unit");
  const season = await prisma.season.findFirstOrThrow({ where: { id: seasonId, workspaceId: workspace.id } });
  const participantIds = input.participantIds === undefined ? null : stringArray(input.participantIds);
  if (participantIds && participantIds.length === 0) throw new Error("Select at least one player for this training.");
  if (participantIds) {
    const count = await prisma.player.count({ where: { id: { in: participantIds }, workspaceId: workspace.id, active: true } });
    if (count !== participantIds.length) throw new Error("One or more selected players are unavailable.");
  }

  const training = await prisma.$transaction(async (tx) => {
    await tx.training.update({
      where: { id: trainingId },
      data: {
        title: `${season.name} · MC ${microcycleNumber} · TU ${trainingUnitNumber}`,
        season: season.name,
        seasonId,
        microcycleNumber,
        trainingUnitNumber,
        trainingDate: input.trainingDate === undefined ? undefined : validDate(input.trainingDate),
        notes: input.notes === undefined ? undefined : optionalString(input.notes),
      },
    });
    if (participantIds) {
      await tx.trainingPlayer.deleteMany({ where: { trainingId } });
      await tx.trainingPlayer.createMany({ data: participantIds.map((playerId, sortOrder) => ({ trainingId, playerId, sortOrder })) });
    }
    return tx.training.findUniqueOrThrow({ where: { id: trainingId }, include: trainingInclude });
  });
  return serializeTraining(training as unknown as Record<string, unknown>);
}

export async function deleteTraining(trainingId: string) {
  const account = await requireManagementWorkspace();
  const { workspace } = account;
  const training = await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id }, include: { video: true } });
  if (training.video?.mediaAssetId) {
    const { appId, mediaWorkspace } = await ensureMediaWorkspace(account);
    const asset = await mediaPrisma.mediaAsset.findFirst({ where: { id: training.video.mediaAssetId, mediaWorkspaceId: mediaWorkspace.id } });
    if (asset?.storageStatus === "UPLOADING" && asset.uploadId) {
      await abortMediaMultipartUpload(asset.storageKey, asset.uploadId).catch(() => undefined);
      await mediaPrisma.mediaAsset.update({ where: { id: asset.id }, data: { storageStatus: "FAILED", uploadId: null } });
    }
    await removeMediaReference(appId, training.video.id);
  } else {
    if (training.video?.storageKey && training.video.uploadId) await abortMultipartUpload(training.video.storageKey, training.video.uploadId).catch(() => undefined);
    if (training.video?.storageKey) await deleteR2Object(training.video.storageKey);
  }
  await prisma.training.delete({ where: { id: trainingId } });
}

export async function saveVideo(trainingId: string, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id }, select: { id: true } });
  const video = await prisma.video.upsert({
    where: { trainingId },
    update: {
      fileName: String(input.fileName), fileSize: BigInt(Number(input.fileSize)), durationSeconds: Number(input.durationSeconds),
      mimeType: String(input.mimeType || "video/mp4"), lastModified: input.lastModified ? new Date(String(input.lastModified)) : null,
    },
    create: {
      trainingId, fileName: String(input.fileName), fileSize: BigInt(Number(input.fileSize)), durationSeconds: Number(input.durationSeconds),
      mimeType: String(input.mimeType || "video/mp4"), lastModified: input.lastModified ? new Date(String(input.lastModified)) : null,
    },
  });
  return serializeVideo(video);
}

export async function getSettings() {
  const { workspace } = await requireWorkspace();
  const momentTypes = await prisma.momentType.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return { momentTypes };
}

export async function createMoment(trainingId: string, input: Record<string, unknown>) {
  const { user, workspace } = await requireManagementWorkspace();
  const start = Number(input.startTimeSeconds);
  const end = Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid moment interval.");
  await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id } });
  const momentTypeId = String(input.momentTypeId || "");
  await prisma.momentType.findFirstOrThrow({ where: { id: momentTypeId, workspaceId: workspace.id }, select: { id: true } });
  const exerciseId = await exerciseIdAtTime(trainingId, end, input.exerciseId);
  return prisma.moment.create({
    data: { trainingId, momentTypeId, exerciseId, startTimeSeconds: start, endTimeSeconds: end, durationSeconds: end - start, notes: optionalString(input.notes), outcome: optionalString(input.outcome), createdByUserId: user.id },
    include: { momentType: true, exercise: true, createdBy: { select: { id: true, name: true, username: true } } },
  });
}

export async function updateMoment(momentId: string, input: Record<string, unknown>) {
  const { user, workspace } = await requireWorkspace();
  const current = await prisma.moment.findFirstOrThrow({ where: { id: momentId, training: { workspaceId: workspace.id } } });
  if (current.createdByUserId && current.createdByUserId !== user.id && user.role !== "admin") throw new Error("Only the staff member who tagged this moment can edit it.");
  if (input.momentTypeId !== undefined) await prisma.momentType.findFirstOrThrow({ where: { id: String(input.momentTypeId), workspaceId: workspace.id } });
  const start = input.startTimeSeconds === undefined ? current.startTimeSeconds : Number(input.startTimeSeconds);
  const end = input.endTimeSeconds === undefined ? current.endTimeSeconds : Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid moment interval.");
  return prisma.moment.update({
    where: { id: momentId },
    data: {
      momentTypeId: input.momentTypeId === undefined ? undefined : String(input.momentTypeId),
      exerciseId: await exerciseIdAtTime(current.trainingId, end, input.exerciseId),
      startTimeSeconds: start, endTimeSeconds: end, durationSeconds: end - start,
      notes: input.notes === undefined ? undefined : optionalString(input.notes), outcome: input.outcome === undefined ? undefined : optionalString(input.outcome),
    },
    include: { momentType: true, exercise: true, createdBy: { select: { id: true, name: true, username: true } } },
  });
}

export async function deleteMoment(id: string) {
  const { user, workspace } = await requireWorkspace();
  const moment = await prisma.moment.findFirstOrThrow({ where: { id, training: { workspaceId: workspace.id } }, select: { createdByUserId: true } });
  if (moment.createdByUserId && moment.createdByUserId !== user.id && user.role !== "admin") throw new Error("Only the staff member who tagged this moment can delete it.");
  return prisma.moment.delete({ where: { id } });
}

export async function createPlayerAction(trainingId: string, input: Record<string, unknown>) {
  const { user, workspace } = await requireManagementWorkspace();
  const playerId = String(input.playerId || "");
  const start = Number(input.startTimeSeconds);
  const end = Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid player action interval.");
  await prisma.trainingPlayer.findFirstOrThrow({ where: { trainingId, playerId, training: { workspaceId: workspace.id } } });
  const exerciseId = await exerciseIdAtTime(trainingId, end, input.exerciseId);
  return prisma.playerAction.create({
    data: { trainingId, playerId, exerciseId, startTimeSeconds: start, endTimeSeconds: end, durationSeconds: end - start, notes: optionalString(input.notes), outcome: optionalString(input.outcome), createdByUserId: user.id },
    include: { player: true, exercise: true, createdBy: { select: { id: true, name: true, username: true } } },
  });
}

export async function updatePlayerAction(actionId: string, input: Record<string, unknown>) {
  const { user, workspace } = await requireWorkspace();
  const current = await prisma.playerAction.findFirstOrThrow({ where: { id: actionId, training: { workspaceId: workspace.id } } });
  if (current.createdByUserId && current.createdByUserId !== user.id && user.role !== "admin") throw new Error("Only the staff member who tagged this action can edit it.");
  const start = input.startTimeSeconds === undefined ? current.startTimeSeconds : Number(input.startTimeSeconds);
  const end = input.endTimeSeconds === undefined ? current.endTimeSeconds : Number(input.endTimeSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid player action interval.");
  return prisma.playerAction.update({
    where: { id: actionId },
    data: { startTimeSeconds: start, endTimeSeconds: end, durationSeconds: end - start, notes: input.notes === undefined ? undefined : optionalString(input.notes), outcome: input.outcome === undefined ? undefined : optionalString(input.outcome), exerciseId: await exerciseIdAtTime(current.trainingId, end, input.exerciseId) },
    include: { player: true, exercise: true, createdBy: { select: { id: true, name: true, username: true } } },
  });
}

export async function deletePlayerAction(actionId: string) {
  const { user, workspace } = await requireWorkspace();
  const action = await prisma.playerAction.findFirstOrThrow({ where: { id: actionId, training: { workspaceId: workspace.id } }, select: { createdByUserId: true } });
  if (action.createdByUserId && action.createdByUserId !== user.id && user.role !== "admin") throw new Error("Only the staff member who tagged this action can delete it.");
  return prisma.playerAction.delete({ where: { id: actionId } });
}

export async function startExercise(trainingId: string, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  const at = nonNegativeNumber(input.timeSeconds, "Exercise start time");
  await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id } });
  const open = await prisma.exercise.findFirst({ where: { trainingId, endTimeSeconds: null } });
  if (open) throw new Error(`Exercise ${open.number} is already running.`);
  const latest = await prisma.exercise.findFirst({ where: { trainingId }, orderBy: { number: "desc" } });
  return prisma.exercise.create({ data: { trainingId, number: (latest?.number ?? 0) + 1, startTimeSeconds: at } });
}

export async function endExercise(trainingId: string, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  const at = nonNegativeNumber(input.timeSeconds, "Exercise end time");
  await prisma.training.findFirstOrThrow({ where: { id: trainingId, workspaceId: workspace.id } });
  const open = await prisma.exercise.findFirst({ where: { trainingId, endTimeSeconds: null }, orderBy: { number: "desc" } });
  if (!open) throw new Error("There is no active exercise.");
  if (at <= open.startTimeSeconds) throw new Error("Exercise end must be after its start.");
  return prisma.exercise.update({ where: { id: open.id }, data: { endTimeSeconds: at } });
}

export async function saveMomentType(input: Record<string, unknown>, id?: string) {
  const { workspace } = await requireManagementWorkspace();
  const name = String(input.name || "").trim();
  const code = String(input.code || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name || !code) throw new Error("Name and code are required.");
  const defaultShortcut = optionalString(input.defaultShortcut)?.toUpperCase() ?? null;
  if (defaultShortcut && !/^[A-Z0-9]$/.test(defaultShortcut)) throw new Error("Shortcut must be one letter or number.");
  if (defaultShortcut) {
    const conflict = await prisma.momentType.findFirst({ where: { workspaceId: workspace.id, defaultShortcut, id: id ? { not: id } : undefined } });
    if (conflict) throw new Error(`Shortcut ${defaultShortcut} is already used by ${conflict.name}.`);
  }
  const data = { name, code, color: String(input.color || "#22d3ee"), defaultShortcut, sortOrder: Number(input.sortOrder || 0), active: input.active === undefined ? true : Boolean(input.active) };
  if (id) {
    await prisma.momentType.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
    return prisma.momentType.update({ where: { id }, data });
  }
  return prisma.momentType.create({ data: { ...data, workspaceId: workspace.id } });
}

export async function deleteMomentType(id: string) {
  const { workspace } = await requireManagementWorkspace();
  await prisma.momentType.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
  if (await prisma.moment.count({ where: { momentTypeId: id } })) throw new Error("This moment type is already used and cannot be deleted. Deactivate it instead.");
  return prisma.momentType.delete({ where: { id } });
}

async function exerciseIdAtTime(trainingId: string, timeSeconds: number, requested: unknown) {
  if (requested !== undefined && requested !== null && String(requested)) {
    return (await prisma.exercise.findFirstOrThrow({ where: { id: String(requested), trainingId }, select: { id: true } })).id;
  }
  const exercise = await prisma.exercise.findFirst({
    where: { trainingId, startTimeSeconds: { lte: timeSeconds }, OR: [{ endTimeSeconds: null }, { endTimeSeconds: { gte: timeSeconds } }] },
    orderBy: { number: "desc" },
    select: { id: true },
  });
  return exercise?.id ?? null;
}

function optionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function validDate(value: unknown) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) throw new Error("A valid training date is required.");
  return date;
}

function positiveInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`${label} must be a positive whole number.`);
  return number;
}

function nonNegativeNumber(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} is invalid.`);
  return number;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter(Boolean))];
}

export type TrainingUpdateInput = Prisma.TrainingUncheckedUpdateInput;
