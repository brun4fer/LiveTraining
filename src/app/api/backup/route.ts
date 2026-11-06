import { prisma } from "@/lib/prisma";
import { requireManagementWorkspace } from "@/lib/auth";

export async function GET() {
  const { workspace } = await requireManagementWorkspace();
  const trainingWhere = { workspaceId: workspace.id };
  const [seasons, players, trainings, participants, plannedExercises, exercises, videos, momentTypes, moments, playerActions, liveSessions, recordingSegments, playlists, playlistItems] = await Promise.all([
    prisma.season.findMany({ where: trainingWhere }),
    prisma.player.findMany({ where: trainingWhere }),
    prisma.training.findMany({ where: trainingWhere }),
    prisma.trainingPlayer.findMany({ where: { training: trainingWhere } }),
    prisma.plannedExercise.findMany({ where: { training: trainingWhere } }),
    prisma.exercise.findMany({ where: { training: trainingWhere } }),
    prisma.video.findMany({ where: { training: trainingWhere } }),
    prisma.momentType.findMany({ where: trainingWhere }),
    prisma.moment.findMany({ where: { training: trainingWhere } }),
    prisma.playerAction.findMany({ where: { training: trainingWhere } }),
    prisma.liveSession.findMany({ where: { training: trainingWhere } }),
    prisma.recordingSegment.findMany({ where: { liveSession: { training: trainingWhere } } }),
    prisma.playlist.findMany({ where: trainingWhere }),
    prisma.playlistItem.findMany({ where: { playlist: trainingWhere } }),
  ]);
  const payload = { version: 2, product: "LiveTraining", team: workspace.name, exportedAt: new Date().toISOString(), seasons, players, trainings, participants, plannedExercises, exercises, videos, momentTypes, moments, playerActions, liveSessions, recordingSegments, playlists, playlistItems };
  const body = JSON.stringify(payload, (_key, value) => typeof value === "bigint" ? value.toString() : value, 2);
  const date = new Date().toISOString().slice(0, 10);
  const safeTeam = workspace.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "team";
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${safeTeam}-training-backup-${date}.json"`, "Cache-Control": "no-store" } });
}
