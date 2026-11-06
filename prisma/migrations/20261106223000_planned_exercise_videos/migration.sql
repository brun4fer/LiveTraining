-- Store an independent cloud video association for each planned exercise.
ALTER TABLE "PlannedExercise"
ADD COLUMN "videoFileName" TEXT,
ADD COLUMN "videoFileSize" BIGINT,
ADD COLUMN "videoDurationSeconds" DOUBLE PRECISION,
ADD COLUMN "videoMimeType" TEXT,
ADD COLUMN "videoLastModified" TIMESTAMP(3),
ADD COLUMN "videoStorageStatus" "VideoStorageStatus",
ADD COLUMN "videoMediaAssetId" TEXT,
ADD COLUMN "videoEtag" TEXT,
ADD COLUMN "videoUploadedAt" TIMESTAMP(3);
