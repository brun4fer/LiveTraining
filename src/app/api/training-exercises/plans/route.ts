import { handleApiError } from "@/lib/api";
import { requireManagementWorkspace } from "@/lib/auth";
import { getTrainingExercisesProject, listTrainingExercisesPlans } from "@/lib/training-exercises-import";

export async function GET(request: Request) {
  try {
    const { user, workspace } = await requireManagementWorkspace();
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (projectId) {
      return Response.json(await getTrainingExercisesProject({ username: user.username, workspaceName: workspace.name, projectId }));
    }
    return Response.json(await listTrainingExercisesPlans({ username: user.username, workspaceName: workspace.name }));
  } catch (error) {
    return handleApiError(error);
  }
}
