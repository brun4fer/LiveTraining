type TrainingPlanExercise = { name: string; description: string; diagramSvg: string };

export type TrainingExercisesSession = { date: string; season: string; microcycle: string; trainingUnit: string };
export type TrainingExercisesPlanSummary = {
  id: string;
  name: string;
  session: TrainingExercisesSession;
  updatedAt: string;
  exerciseCount: number;
};
export type TrainingExercisesPlanDetail = {
  id: string;
  name: string;
  session: TrainingExercisesSession;
  exercises: TrainingPlanExercise[];
};

type ImportedTrainingPlan = { id: string; name: string; session?: TrainingExercisesSession; exercises?: TrainingPlanExercise[] };
type ImportInput = { username: string; workspaceName: string };

function config() {
  const url = process.env.TRAINING_EXERCISES_URL?.replace(/\/$/, "");
  const secret = process.env.TRAINING_PLAN_SYNC_SECRET;
  if (!url || !secret) return null;
  return { url, secret };
}

async function requestTrainingExercises<T>(body: Record<string, unknown>, unavailableMessage: string) {
  const settings = config();
  if (!settings) throw new Error("Training Exercises integration is not configured yet.");
  const response = await fetch(`${settings.url}/api/training-exercises/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${settings.secret}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error || unavailableMessage);
  return payload as T;
}

function exercisesForTraining(plan?: ImportedTrainingPlan | null) {
  return plan?.exercises?.map((exercise) => ({
    name: exercise.name,
    description: exercise.description,
    durationMinutes: null,
    diagramSvg: exercise.diagramSvg,
  })) ?? null;
}

export async function listTrainingExercisesPlans(input: ImportInput) {
  const payload = await requestTrainingExercises<{ plans?: TrainingExercisesPlanSummary[] }>({ ...input, action: "list" }, "Could not load Training Exercises projects.");
  return payload.plans ?? [];
}

export async function getTrainingExercisesProject(input: ImportInput & { projectId: string }) {
  const payload = await requestTrainingExercises<{ plan?: ImportedTrainingPlan }>({ ...input, action: "project", projectId: input.projectId }, "Could not import the selected Training Exercises project.");
  if (!payload.plan?.session) throw new Error("The selected Training Exercises project is incomplete.");
  return payload.plan as TrainingExercisesPlanDetail;
}

export async function importTrainingExercisesProject(input: ImportInput & { projectId: string }) {
  return exercisesForTraining(await getTrainingExercisesProject(input));
}

export async function importTrainingExercisesPlan(input: ImportInput & TrainingExercisesSession) {
  if (!config()) return null;
  const payload = await requestTrainingExercises<{ plan?: ImportedTrainingPlan | null }>({
    username: input.username,
    workspaceName: input.workspaceName,
    session: { date: input.date, season: input.season, microcycle: input.microcycle, trainingUnit: input.trainingUnit },
  }, "Could not import the matching Training Exercises plan.");
  return exercisesForTraining(payload.plan);
}
