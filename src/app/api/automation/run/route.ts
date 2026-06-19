import { fail, ok } from "@/lib/http";
import { logAutomationRun } from "@/lib/services/data-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return ok(
      await logAutomationRun({
        triggerType: body.triggerType ?? "daily_plan",
        status: "completed",
        payload: body,
        result: { executedAt: new Date().toISOString() },
      }),
    );
  } catch (error) {
    return fail("Falha ao executar automacao.", 500, String(error));
  }
}
