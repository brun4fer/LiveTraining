import { PlannedExercisesManager } from "@/components/planned-exercises-manager";

export default async function TrainingPlanPage({ params }: { params: Promise<{ trainingId: string }> }) {
  return <PlannedExercisesManager trainingId={(await params).trainingId} />;
}
