import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

type CameraPairingPayload = {
  purpose: "live-training-camera";
  trainingId: string;
  workspaceId: string;
  userId: string;
  exp: number;
  nonce: string;
};

function secret() {
  const value = process.env.AUTH_SECRET?.trim();
  if (!value) throw new Error("AUTH_SECRET is required to pair a phone camera.");
  return value;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createCameraPairingToken(input: Pick<CameraPairingPayload, "trainingId" | "workspaceId" | "userId">) {
  const expiresAt = Date.now() + TOKEN_LIFETIME_MS;
  const payload: CameraPairingPayload = {
    purpose: "live-training-camera",
    ...input,
    exp: expiresAt,
    nonce: randomBytes(18).toString("base64url"),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${data}.${sign(data)}`, expiresAt: new Date(expiresAt).toISOString() };
}

export function cameraPairingTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readCameraPairingToken(token: string) {
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;
  const expected = sign(data);
  const providedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length || !timingSafeEqual(providedBytes, expectedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as CameraPairingPayload;
    if (payload.purpose !== "live-training-camera" || payload.exp <= Date.now()) return null;
    if (![payload.trainingId, payload.workspaceId, payload.userId, payload.nonce].every((value) => typeof value === "string" && value.length > 0)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireCameraPairing(token: string) {
  const payload = readCameraPairingToken(token);
  if (!payload) throw new Error("This camera link is invalid or has expired. Generate a new QR code on the training computer.");
  const [training, user] = await Promise.all([
    prisma.training.findFirst({ where: { id: payload.trainingId, workspaceId: payload.workspaceId }, select: { id: true, title: true, workspaceId: true } }),
    prisma.user.findFirst({ where: { id: payload.userId, workspaceId: payload.workspaceId }, select: { id: true } }),
  ]);
  if (!training || !user) throw new Error("This camera link no longer belongs to an active workspace.");
  return { payload, training };
}

export async function requireActiveCameraPairing(token: string) {
  const pairing = await requireCameraPairing(token);
  const connection = await prisma.wirelessCameraConnection.findFirst({
    where: {
      trainingId: pairing.payload.trainingId,
      workspaceId: pairing.payload.workspaceId,
      tokenHash: cameraPairingTokenHash(token),
      expiresAt: { gt: new Date() },
    },
  });
  if (!connection) throw new Error("This camera link was replaced or has expired. Scan the latest QR code from the training computer.");
  return { ...pairing, connection };
}
