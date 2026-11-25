type TrainingPlanExercise = { name: string; description: string; diagramSvg: string };

export async function importTrainingExercisesPlan(input: { username: string; workspaceName: string; date: string; season: string; microcycle: string; trainingUnit: string }) {
  const url = process.env.TRAINING_EXERCISES_URL?.replace(/\/$/, "");
  const secret = process.env.TRAINING_PLAN_SYNC_SECRET;
  if (!url || !secret) return null;
  const response = await fetch(`${url}/api/training-exercises/export`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` }, body: JSON.stringify({ username: input.username, workspaceName: input.workspaceName, session: { date: input.date, season: input.season, microcycle: input.microcycle, trainingUnit: input.trainingUnit } }), cache: "no-store" });
  if (!response.ok) throw new Error("Could not import the matching Training Exercises plan.");
  const payload = await response.json() as { plan?: { exercises?: TrainingPlanExercise[] } | null };
  return payload.plan?.exercises?.map((exercise) => ({ name: exercise.name, description: exercise.description, durationMinutes: null, diagramSvg: exercise.diagramSvg })) ?? null;
}
