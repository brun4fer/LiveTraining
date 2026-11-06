-- Add pre-planned exercises, their uploaded images and an optional link from recorded intervals.
CREATE TABLE "PlannedExercise" (
    "id" TEXT NOT NULL,
    "trainingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER,
    "imageStorageKey" TEXT,
    "imageFileName" TEXT,
    "imageMimeType" TEXT,
    "imageFileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlannedExercise_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Exercise" ADD COLUMN "plannedExerciseId" TEXT;

CREATE UNIQUE INDEX "PlannedExercise_imageStorageKey_key" ON "PlannedExercise"("imageStorageKey");
CREATE UNIQUE INDEX "PlannedExercise_trainingId_number_key" ON "PlannedExercise"("trainingId", "number");
CREATE INDEX "PlannedExercise_trainingId_number_idx" ON "PlannedExercise"("trainingId", "number");
CREATE UNIQUE INDEX "Exercise_trainingId_plannedExerciseId_key" ON "Exercise"("trainingId", "plannedExerciseId");
CREATE INDEX "Exercise_plannedExerciseId_idx" ON "Exercise"("plannedExerciseId");

ALTER TABLE "PlannedExercise" ADD CONSTRAINT "PlannedExercise_trainingId_fkey"
FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_plannedExerciseId_fkey"
FOREIGN KEY ("plannedExerciseId") REFERENCES "PlannedExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
