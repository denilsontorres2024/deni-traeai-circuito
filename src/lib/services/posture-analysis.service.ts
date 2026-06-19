import { runAutomationOrchestrator } from "@/lib/automation/automation-orchestrator";
import { interpretPostureWithOpenAI } from "@/lib/posture/openai-posture-interpreter";
import { detectIssues, riskLevelFromScore, scoreFromMetrics } from "@/lib/posture/posture-metrics";
import { postureAnalyzeSchema } from "@/lib/schemas/posture";
import { savePostureAnalysis } from "@/lib/services/data-service";

export async function analyzeAndPersistPosture(payload: unknown) {
  const parsed = postureAnalyzeSchema.parse(payload);
  const metrics = parsed.metrics;
  const score = scoreFromMetrics(metrics);
  const riskLevel = riskLevelFromScore(score);
  const detectedIssues = detectIssues(metrics);

  const interpretation = await interpretPostureWithOpenAI({
    imageBase64: parsed.imageBase64,
    landmarks: parsed.landmarks,
    metrics,
    notes: parsed.notes,
  });

  const analysis = await savePostureAnalysis({
    input_mode: parsed.mode,
    score: interpretation.score ?? score,
    risk_level: interpretation.riskLevel ?? riskLevel,
    confidence: interpretation.confidence,
    summary: interpretation.summary,
    diagnosis: interpretation.diagnosis,
    detected_issues: interpretation.detectedIssues.length
      ? interpretation.detectedIssues
      : detectedIssues,
    recommendations: interpretation.recommendations,
    exercises: interpretation.exercises,
    daily_plan: interpretation.dailyPlan,
    metrics,
    landmarks: parsed.landmarks,
    media_url: parsed.fileUrl ?? null,
    raw_ai_response: interpretation.raw,
  });

  const automation = await runAutomationOrchestrator({
    postureAnalysisId: analysis.id,
    score: Number(analysis.score),
    riskLevel: analysis.risk_level,
    issues: analysis.detected_issues ?? detectedIssues,
  });

  return {
    analysis,
    automation,
  };
}
