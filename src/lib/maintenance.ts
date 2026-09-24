import { prisma } from "@/lib/prisma";
import { requireManagementWorkspace, requireWorkspace } from "@/lib/auth";

export type MaintenanceResource = "seasons" | "players";

export function isMaintenanceResource(value: string): value is MaintenanceResource {
  return value === "seasons" || value === "players";
}

export async function listMaintenance(resource: MaintenanceResource) {
  const { workspace } = await requireWorkspace();
  if (resource === "seasons") return prisma.season.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ startDate: "desc" }, { name: "desc" }] });
  return prisma.player.findMany({ where: { workspaceId: workspace.id }, orderBy: [{ active: "desc" }, { shirtNumber: "asc" }, { name: "asc" }] });
}

export async function createMaintenance(resource: MaintenanceResource, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  try {
    if (resource === "seasons") return prisma.season.create({ data: { ...seasonData(input), workspaceId: workspace.id } });
    return prisma.player.create({ data: { ...playerData(input), workspaceId: workspace.id } });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("A record with this name already exists.");
    throw error;
  }
}

export async function updateMaintenance(resource: MaintenanceResource, id: string, input: Record<string, unknown>) {
  const { workspace } = await requireManagementWorkspace();
  try {
    if (resource === "seasons") {
      await prisma.season.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
      return prisma.$transaction(async (tx) => {
        const season = await tx.season.update({ where: { id }, data: seasonData(input) });
        const trainings = await tx.training.findMany({ where: { seasonId: id }, select: { id: true, microcycleNumber: true, trainingUnitNumber: true } });
        for (const training of trainings) {
          await tx.training.update({ where: { id: training.id }, data: { season: season.name, title: `${season.name} · MC ${training.microcycleNumber} · TU ${training.trainingUnitNumber}` } });
        }
        return season;
      });
    }
    await prisma.player.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
    return prisma.player.update({ where: { id }, data: playerData(input) });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new Error("A record with this name already exists.");
    throw error;
  }
}

export async function deleteMaintenance(resource: MaintenanceResource, id: string) {
  const { workspace } = await requireManagementWorkspace();
  if (resource === "seasons") {
    await prisma.season.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
    if (await prisma.training.count({ where: { seasonId: id } })) throw new Error("This season is in use and cannot be deleted.");
    await prisma.season.delete({ where: { id } });
    return;
  }
  await prisma.player.findFirstOrThrow({ where: { id, workspaceId: workspace.id } });
  const [trainings, actions] = await Promise.all([
    prisma.trainingPlayer.count({ where: { playerId: id } }),
    prisma.playerAction.count({ where: { playerId: id } }),
  ]);
  if (trainings || actions) throw new Error("This player is already used. Mark the player inactive instead.");
  await prisma.player.delete({ where: { id } });
}

function seasonData(input: Record<string, unknown>) {
  const name = requiredName(input.name);
  const startDate = optionalDate(input.startDate);
  const endDate = optionalDate(input.endDate);
  if (startDate && endDate && endDate < startDate) throw new Error("The season end date must be after its start date.");
  return { name, startDate, endDate };
}

function playerData(input: Record<string, unknown>) {
  const shirtNumber = input.shirtNumber === "" || input.shirtNumber === null || input.shirtNumber === undefined ? null : Number(input.shirtNumber);
  if (shirtNumber !== null && (!Number.isInteger(shirtNumber) || shirtNumber < 0 || shirtNumber > 999)) throw new Error("Shirt number must be a whole number between 0 and 999.");
  return { name: requiredName(input.name), shirtNumber, position: optionalText(input.position), active: input.active === undefined ? true : Boolean(input.active) };
}

function requiredName(value: unknown) {
  const name = String(value || "").trim();
  if (!name) throw new Error("Name is required.");
  return name;
}

function optionalText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function optionalDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
