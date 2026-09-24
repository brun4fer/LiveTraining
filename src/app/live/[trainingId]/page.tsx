import { LiveWorkspace } from "@/components/live-workspace";

export default async function LiveTrainingPage({ params }: { params: Promise<{ trainingId: string }> }) {
  return <LiveWorkspace trainingId={(await params).trainingId} />;
}
