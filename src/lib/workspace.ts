import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { defaultMomentTypes } from "@/lib/default-analysis-types";

export async function createWorkspaceForUser(userId: string, rawName: unknown) {
  const name = String(rawName || "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Team name must contain between 2 and 80 characters.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.workspaceId) throw new Error("This account already has a team.");
    const workspace = await tx.workspace.create({ data: { name } });
    await tx.momentType.createMany({ data: defaultMomentTypes.map((type) => ({ ...type, workspaceId: workspace.id })) });
    await tx.user.update({ where: { id: userId }, data: { workspaceId: workspace.id, role: "admin" } });
    await tx.playlist.create({ data: { workspaceId: workspace.id, userId, name: "My training review", isDefault: true } });
    return workspace;
  });
}

function inviteHash(code: string) {
  return createHash("sha256").update(code.trim()).digest("hex");
}

export async function createWorkspaceInvite(userId: string, workspaceId: string, role = "analyst") {
  const code = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.workspaceInvite.create({ data: { workspaceId, createdByUserId: userId, codeHash: inviteHash(code), role: role === "admin" ? "admin" : "analyst", expiresAt } });
  return { code, expiresAt: expiresAt.toISOString() };
}

export async function joinWorkspaceWithInvite(userId: string, rawCode: unknown) {
  const code = String(rawCode || "").trim();
  if (code.length < 20) throw new Error("Enter a valid team invitation code.");
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.workspaceId) throw new Error("This account already belongs to a team.");
    const invite = await tx.workspaceInvite.findFirst({ where: { codeHash: inviteHash(code), claimedAt: null, expiresAt: { gt: new Date() } }, include: { workspace: true } });
    if (!invite) throw new Error("This invitation code is invalid, expired or has already been used.");
    await tx.user.update({ where: { id: userId }, data: { workspaceId: invite.workspaceId, role: invite.role } });
    await tx.workspaceInvite.update({ where: { id: invite.id }, data: { claimedByUserId: userId, claimedAt: new Date() } });
    await tx.playlist.create({ data: { workspaceId: invite.workspaceId, userId, name: "My training review", isDefault: true } });
    return { workspace: invite.workspace, role: invite.role };
  });
}
