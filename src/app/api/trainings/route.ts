import { handleApiError, readJson } from "@/lib/api";
import { createTraining, listTrainings } from "@/lib/data-store";

export async function GET() {
  try { return Response.json(await listTrainings()); }
  catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try { return Response.json(await createTraining(await readJson<Record<string, unknown>>(request)), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}

