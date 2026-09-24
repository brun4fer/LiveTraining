export type MomentTypeRecord = {
  id: string;
  name: string;
  code: string;
  color: string;
  defaultShortcut: string | null;
  sortOrder: number;
  active: boolean;
};

export type ExerciseRecord = {
  id: string;
  trainingId: string;
  number: number;
  startTimeSeconds: number;
  endTimeSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerRecord = {
  id: string;
  name: string;
  shirtNumber: number | null;
  position: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlayerActionRecord = {
  id: string;
  trainingId: string;
  playerId: string;
  exerciseId: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  notes: string | null;
  outcome: string | null;
  createdByUserId?: string | null;
  liveSessionId?: string | null;
  markedAtSeconds?: number | null;
  leadSeconds?: number | null;
  capturedFromLive?: boolean;
  createdBy?: { id: string; name: string; username: string } | null;
  player: PlayerRecord;
  exercise?: ExerciseRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type MomentRecord = {
  id: string;
  trainingId: string;
  momentTypeId: string;
  exerciseId: string | null;
  startTimeSeconds: number;
  endTimeSeconds: number;
  durationSeconds: number;
  notes: string | null;
  outcome: string | null;
  createdByUserId?: string | null;
  liveSessionId?: string | null;
  markedAtSeconds?: number | null;
  leadSeconds?: number | null;
  capturedFromLive?: boolean;
  createdBy?: { id: string; name: string; username: string } | null;
  createdAt: string;
  updatedAt: string;
  momentType: MomentTypeRecord;
  exercise?: ExerciseRecord | null;
};

export type LiveSegmentRecord = {
  id: string;
  sequence: number;
  startedAtSeconds: number;
  durationSeconds: number | null;
  mimeType: string;
  fileSize: string | null;
  status: "UPLOADING" | "READY" | "FAILED";
  readyAt: string | null;
  playbackUrl: string | null;
  playbackUrlExpiresAt: string | null;
};

export type LiveSessionRecord = {
  id: string;
  trainingId: string;
  status: "PREPARING" | "LIVE" | "ENDED" | "FAILED";
  sourceType: "BROWSER_CAMERA" | "EXTERNAL_ENCODER";
  provider: string;
  playbackUrl: string | null;
  recordingStartedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  lastSegmentAt: string | null;
  startedBy: { id: string; name: string; username: string };
  segments: LiveSegmentRecord[];
  publishUrl?: string | null;
  realtimeAvailable?: boolean;
  realtimeError?: string | null;
};

export type PlaylistRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  isDefault: boolean;
  visibility: "PERSONAL" | "WORKSPACE";
  user: { id: string; name: string; username: string };
  items: Array<{
    id: string;
    note: string | null;
    sortOrder: number;
    moment: MomentRecord & { training: { id: string; title: string } };
  }>;
};

export type VideoRecord = {
  id: string;
  trainingId: string;
  fileName: string;
  fileSize: number;
  durationSeconds: number;
  mimeType: string;
  storageStatus: "LOCAL" | "UPLOADING" | "READY" | "FAILED";
  uploadedAt?: string | null;
};

export type TrainingSummary = {
  id: string;
  title: string;
  season: string;
  microcycleNumber: number;
  trainingUnitNumber: number;
  trainingDate: string;
  seasonId: string;
  video?: VideoRecord | null;
  momentCount: number;
  playerActionCount: number;
  exerciseCount: number;
  participantCount: number;
  liveStatus?: "PREPARING" | "LIVE" | "ENDED" | "FAILED" | null;
};

export type TrainingDetail = TrainingSummary & {
  notes: string | null;
  video: VideoRecord | null;
  moments: MomentRecord[];
  playerActions: PlayerActionRecord[];
  exercises: ExerciseRecord[];
  participants: Array<{ playerId: string; sortOrder: number; player: PlayerRecord }>;
};

export type SettingsPayload = {
  momentTypes: MomentTypeRecord[];
};

export type AccountPayload = {
  id: string;
  name: string;
  username: string;
  teamName: string | null;
  needsOnboarding: boolean;
  managementAccess: { configured: boolean; unlocked: boolean };
};

export type MaintenanceRecord = {
  id: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  shirtNumber?: number | null;
  position?: string | null;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
};
