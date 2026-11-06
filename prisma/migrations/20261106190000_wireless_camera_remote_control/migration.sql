-- Add a persistent, workspace-scoped control channel for wireless training cameras.
CREATE TABLE "WirelessCameraConnection" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pairedByUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "desiredBroadcasting" BOOLEAN NOT NULL DEFAULT false,
    "broadcasting" BOOLEAN NOT NULL DEFAULT false,
    "endRequested" BOOLEAN NOT NULL DEFAULT false,
    "commandVersion" INTEGER NOT NULL DEFAULT 0,
    "acknowledgedVersion" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "broadcastStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WirelessCameraConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WirelessCameraConnection_trainingId_key" ON "WirelessCameraConnection"("trainingId");
CREATE UNIQUE INDEX "WirelessCameraConnection_tokenHash_key" ON "WirelessCameraConnection"("tokenHash");
CREATE INDEX "WirelessCameraConnection_workspaceId_lastSeenAt_idx" ON "WirelessCameraConnection"("workspaceId", "lastSeenAt");
CREATE INDEX "WirelessCameraConnection_expiresAt_idx" ON "WirelessCameraConnection"("expiresAt");
