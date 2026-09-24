-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "VideoStorageStatus" AS ENUM ('LOCAL', 'UPLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('PREPARING', 'LIVE', 'ENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "LiveSourceType" AS ENUM ('BROWSER_CAMERA', 'EXTERNAL_ENCODER');

-- CreateEnum
CREATE TYPE "RecordingSegmentStatus" AS ENUM ('UPLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PlaylistVisibility" AS ENUM ('PERSONAL', 'WORKSPACE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "managementPasswordHash" TEXT,
    "managementPasswordVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'analyst',
    "createdByUserId" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspacePresence" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "liveSessionId" TEXT,
    "playbackPositionSeconds" DOUBLE PRECISION,
    "atLiveEdge" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shirtNumber" INTEGER,
    "position" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Training" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "microcycleNumber" INTEGER NOT NULL,
    "trainingUnitNumber" INTEGER NOT NULL,
    "trainingDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "seasonId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Training_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlayer" (
    "trainingId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlayer_pkey" PRIMARY KEY ("trainingId","playerId")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startTimeSeconds" DOUBLE PRECISION NOT NULL,
    "endTimeSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "startedByUserId" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'PREPARING',
    "sourceType" "LiveSourceType" NOT NULL DEFAULT 'BROWSER_CAMERA',
    "provider" TEXT NOT NULL DEFAULT 'segment-dvr',
    "providerSessionId" TEXT,
    "playbackUrl" TEXT,
    "recordingStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "lastSegmentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordingSegment" (
    "id" TEXT NOT NULL,
    "liveSessionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "startedAtSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT,
    "status" "RecordingSegmentStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),

    CONSTRAINT "RecordingSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "lastModified" TIMESTAMP(3),
    "storageKey" TEXT,
    "storageStatus" "VideoStorageStatus" NOT NULL DEFAULT 'LOCAL',
    "uploadId" TEXT,
    "etag" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "mediaAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MomentType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "defaultShortcut" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MomentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moment" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "momentTypeId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "startTimeSeconds" DOUBLE PRECISION NOT NULL,
    "endTimeSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "outcome" TEXT,
    "createdByUserId" TEXT,
    "liveSessionId" TEXT,
    "markedAtSeconds" DOUBLE PRECISION,
    "leadSeconds" DOUBLE PRECISION DEFAULT 20,
    "capturedFromLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAction" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "startTimeSeconds" DOUBLE PRECISION NOT NULL,
    "endTimeSeconds" DOUBLE PRECISION NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "outcome" TEXT,
    "createdByUserId" TEXT,
    "liveSessionId" TEXT,
    "markedAtSeconds" DOUBLE PRECISION,
    "leadSeconds" DOUBLE PRECISION DEFAULT 15,
    "capturedFromLive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "PlaylistVisibility" NOT NULL DEFAULT 'PERSONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_workspaceId_idx" ON "User"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_codeHash_key" ON "WorkspaceInvite"("codeHash");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_expiresAt_idx" ON "WorkspaceInvite"("workspaceId", "expiresAt");

-- CreateIndex
CREATE INDEX "WorkspacePresence_workspaceId_lastSeenAt_idx" ON "WorkspacePresence"("workspaceId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "WorkspacePresence_userId_idx" ON "WorkspacePresence"("userId");

-- CreateIndex
CREATE INDEX "WorkspacePresence_liveSessionId_lastSeenAt_idx" ON "WorkspacePresence"("liveSessionId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePresence_workspaceId_clientId_key" ON "WorkspacePresence"("workspaceId", "clientId");

-- CreateIndex
CREATE INDEX "Season_workspaceId_idx" ON "Season"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Season_workspaceId_name_key" ON "Season"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Player_workspaceId_active_idx" ON "Player"("workspaceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Player_workspaceId_name_key" ON "Player"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Training_workspaceId_trainingDate_idx" ON "Training"("workspaceId", "trainingDate");

-- CreateIndex
CREATE INDEX "Training_seasonId_idx" ON "Training"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "Training_workspaceId_seasonId_microcycleNumber_trainingUnit_key" ON "Training"("workspaceId", "seasonId", "microcycleNumber", "trainingUnitNumber");

-- CreateIndex
CREATE INDEX "TrainingPlayer_playerId_idx" ON "TrainingPlayer"("playerId");

-- CreateIndex
CREATE INDEX "TrainingPlayer_trainingId_sortOrder_idx" ON "TrainingPlayer"("trainingId", "sortOrder");

-- CreateIndex
CREATE INDEX "Exercise_trainingId_startTimeSeconds_idx" ON "Exercise"("trainingId", "startTimeSeconds");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_trainingId_number_key" ON "Exercise"("trainingId", "number");

-- CreateIndex
CREATE INDEX "LiveSession_trainingId_status_idx" ON "LiveSession"("trainingId", "status");

-- CreateIndex
CREATE INDEX "LiveSession_startedByUserId_idx" ON "LiveSession"("startedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSegment_storageKey_key" ON "RecordingSegment"("storageKey");

-- CreateIndex
CREATE INDEX "RecordingSegment_liveSessionId_status_sequence_idx" ON "RecordingSegment"("liveSessionId", "status", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSegment_liveSessionId_sequence_key" ON "RecordingSegment"("liveSessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Video_trainingId_key" ON "Video"("trainingId");

-- CreateIndex
CREATE UNIQUE INDEX "Video_storageKey_key" ON "Video"("storageKey");

-- CreateIndex
CREATE INDEX "Video_mediaAssetId_idx" ON "Video"("mediaAssetId");

-- CreateIndex
CREATE INDEX "MomentType_workspaceId_idx" ON "MomentType"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "MomentType_workspaceId_code_key" ON "MomentType"("workspaceId", "code");

-- CreateIndex
CREATE INDEX "Moment_trainingId_idx" ON "Moment"("trainingId");

-- CreateIndex
CREATE INDEX "Moment_momentTypeId_idx" ON "Moment"("momentTypeId");

-- CreateIndex
CREATE INDEX "Moment_exerciseId_idx" ON "Moment"("exerciseId");

-- CreateIndex
CREATE INDEX "Moment_createdByUserId_idx" ON "Moment"("createdByUserId");

-- CreateIndex
CREATE INDEX "Moment_liveSessionId_markedAtSeconds_idx" ON "Moment"("liveSessionId", "markedAtSeconds");

-- CreateIndex
CREATE INDEX "PlayerAction_trainingId_idx" ON "PlayerAction"("trainingId");

-- CreateIndex
CREATE INDEX "PlayerAction_playerId_idx" ON "PlayerAction"("playerId");

-- CreateIndex
CREATE INDEX "PlayerAction_exerciseId_idx" ON "PlayerAction"("exerciseId");

-- CreateIndex
CREATE INDEX "PlayerAction_createdByUserId_idx" ON "PlayerAction"("createdByUserId");

-- CreateIndex
CREATE INDEX "PlayerAction_liveSessionId_markedAtSeconds_idx" ON "PlayerAction"("liveSessionId", "markedAtSeconds");

-- CreateIndex
CREATE INDEX "Playlist_workspaceId_idx" ON "Playlist"("workspaceId");

-- CreateIndex
CREATE INDEX "Playlist_userId_idx" ON "Playlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_userId_name_key" ON "Playlist"("userId", "name");

-- CreateIndex
CREATE INDEX "PlaylistItem_momentId_idx" ON "PlaylistItem"("momentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistItem_playlistId_momentId_key" ON "PlaylistItem"("playlistId", "momentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePresence" ADD CONSTRAINT "WorkspacePresence_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePresence" ADD CONSTRAINT "WorkspacePresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspacePresence" ADD CONSTRAINT "WorkspacePresence_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Training" ADD CONSTRAINT "Training_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlayer" ADD CONSTRAINT "TrainingPlayer_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlayer" ADD CONSTRAINT "TrainingPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSegment" ADD CONSTRAINT "RecordingSegment_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MomentType" ADD CONSTRAINT "MomentType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_momentTypeId_fkey" FOREIGN KEY ("momentTypeId") REFERENCES "MomentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAction" ADD CONSTRAINT "PlayerAction_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAction" ADD CONSTRAINT "PlayerAction_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAction" ADD CONSTRAINT "PlayerAction_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAction" ADD CONSTRAINT "PlayerAction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAction" ADD CONSTRAINT "PlayerAction_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
