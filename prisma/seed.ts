import { PrismaClient } from "@prisma/client";
import { defaultMomentTypes } from "../src/lib/default-analysis-types";

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({ where: { id: "workspace_live_training" }, update: {}, create: { id: "workspace_live_training", name: "Live Training" } });
  for (const type of defaultMomentTypes) {
    await prisma.momentType.upsert({ where: { workspaceId_code: { workspaceId: workspace.id, code: type.code } }, update: type, create: { ...type, workspaceId: workspace.id } });
  }
}

main().finally(() => prisma.$disconnect());
