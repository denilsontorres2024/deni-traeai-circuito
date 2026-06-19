import { fail, ok } from "@/lib/http";
import { listPostureHistory } from "@/lib/services/data-service";
import { persistDailyPlan } from "@/lib/services/plan-generator.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const latest = (await listPostureHistory(1))[0];

    if (!body.score && !latest) {
      return fail("Realize uma analise postural antes de gerar o plano.", 400);
    }

    return ok(
      await persistDailyPlan({
        score: body.score ?? latest.score,
        riskLevel: body.riskLevel ?? latest.risk_level,
        issues: body.issues ?? latest.detected_issues ?? [],
        freeMinutes: body.freeMinutes ?? 0,
        consecutiveMeetings: body.consecutiveMeetings ?? 0,
        postureAnalysisId: body.postureAnalysisId ?? latest.id,
      }),
    );
  } catch (error) {
    return fail("Falha ao gerar plano diario.", 500, String(error));
  }
}
