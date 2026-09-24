import { AnalysisWorkspace } from "@/components/analysis-workspace";

export default async function AnalysisPage({ params }: { params: Promise<{ trainingId: string }> }) {
  return <AnalysisWorkspace trainingId={(await params).trainingId} />;
}

