import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const prisma = new PrismaClient();
  try {
  const [users, workspaces, trainings, moments, playerActions, exercises, seasons, players, momentTypes] = await Promise.all([
    prisma.user.findMany({ select: { username: true, workspaceId: true }, orderBy: { username: "asc" } }),
    prisma.workspace.findMany({ select: { id: true, name: true } }),
    prisma.training.count(), prisma.moment.count(), prisma.playerAction.count(), prisma.exercise.count(), prisma.season.count(), prisma.player.count(), prisma.momentType.count(),
  ]);
    console.log(JSON.stringify({ users, workspaces, counts: { trainings, moments, playerActions, exercises, seasons, players, momentTypes } }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main();

