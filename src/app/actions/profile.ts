"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }

  const payload = {
    id: user.id,
    email: user.email,
    full_name: String(formData.get("fullName") ?? ""),
    job_title: String(formData.get("jobTitle") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    timezone: String(formData.get("timezone") ?? "UTC"),
    discomfort_areas: String(formData.get("discomfortAreas") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };

  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
  });

  if (error) {
    throw error;
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export async function updatePreferencesAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }

  const payload = {
    user_id: user.id,
    workday_start: String(formData.get("workdayStart") ?? "09:00"),
    workday_end: String(formData.get("workdayEnd") ?? "18:00"),
    preferred_break_minutes: Number(formData.get("preferredBreakMinutes") ?? 5),
    seated_alert_minutes: Number(formData.get("seatedAlertMinutes") ?? 50),
    openai_goal: String(formData.get("openAiGoal") ?? ""),
    settings: {
      remindersEnabled: Boolean(formData.get("remindersEnabled")),
      weeklySummary: Boolean(formData.get("weeklySummary")),
    },
  };

  const { error } = await supabase.from("user_preferences").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
