import { fail, ok } from "@/lib/http";
import { registerSchema } from "@/lib/schemas/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_AUTOMATIONS = [
  "after_analysis",
  "daily_plan",
  "before_meeting",
  "after_meeting",
  "low_score_alert",
  "weekly_summary",
  "monthly_summary",
] as const;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = registerSchema.parse(body);
    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.fullName,
        job_title: payload.jobTitle,
        goal: payload.goal,
      },
    });

    if (error || !data.user) {
      return fail(error?.message ?? "Unable to create account.", 400);
    }

    const user = data.user;

    await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: payload.email,
        full_name: payload.fullName,
        avatar_url: null,
        provider: "email",
        onboarding_completed: false,
        job_title: payload.jobTitle,
        goal: payload.goal,
      },
      { onConflict: "id" },
    );

    await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
      },
      { onConflict: "user_id" },
    );

    await supabase.from("automation_rules").upsert(
      DEFAULT_AUTOMATIONS.map((triggerType, index) => ({
        user_id: user.id,
        trigger_type: triggerType,
        is_enabled: true,
        priority: index + 1,
      })),
      { onConflict: "user_id,trigger_type" },
    );

    return ok({
      userId: user.id,
      email: user.email,
    });
  } catch (error) {
    return fail("Falha ao criar conta.", 500, String(error));
  }
}
