import { buildCalendarInsight } from "@/lib/services/calendar-insights.service";
import { logAutomationRun } from "@/lib/services/data-service";
import { persistDailyPlan } from "@/lib/services/plan-generator.service";
import { sendSmartReminder } from "@/lib/services/notification-router";

export async function runAutomationOrchestrator(input: {
  postureAnalysisId?: string;
  score: number;
  riskLevel: "low" | "medium" | "high";
  issues: string[];
  calendarEvents?: Array<{
    title: string;
    start: string;
    end: string;
  }>;
}) {
  const insight = buildCalendarInsight(input.calendarEvents ?? []);
  const plan = await persistDailyPlan({
    score: input.score,
    riskLevel: input.riskLevel,
    issues: input.issues,
    freeMinutes: insight.freeMinutes,
    consecutiveMeetings: insight.consecutiveMeetings,
    postureAnalysisId: input.postureAnalysisId,
  });

  const reminder =
    input.score < 70
      ? await sendSmartReminder({
          subject: "Seu plano postural do dia esta pronto",
          message:
            "Seu score indica necessidade de correcao. O plano do dia ja foi gerado com pausas e exercicios prioritarios.",
        })
      : null;

  const run = await logAutomationRun({
    triggerType: "after_analysis",
    status: "completed",
    payload: {
      score: input.score,
      riskLevel: input.riskLevel,
      issues: input.issues,
    },
    result: {
      generatedPlanId: plan.id,
      reminderId: reminder?.id ?? null,
    },
  });

  return {
    plan,
    reminder,
    run,
    insight,
  };
}
