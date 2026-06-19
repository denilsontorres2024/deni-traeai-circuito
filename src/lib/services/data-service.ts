import type { User } from "@supabase/supabase-js";

import { createAuthenticatedServerClient } from "@/lib/supabase/request-auth";

type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

const DEFAULT_AUTOMATIONS = [
  "after_analysis",
  "daily_plan",
  "before_meeting",
  "after_meeting",
  "low_score_alert",
  "weekly_summary",
  "monthly_summary",
];

export async function getAuthenticatedContext() {
  const supabase = await createAuthenticatedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Usuario nao autenticado.");
  }

  await ensureUserSetup(user, supabase);

  return { supabase, user };
}

export async function ensureUserSetup(user: User, client?: Awaited<ReturnType<typeof createAuthenticatedServerClient>>) {
  const supabase = client ?? (await createAuthenticatedServerClient());
  const provider =
    user.app_metadata.provider ??
    user.identities?.[0]?.provider ??
    "email";

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata.full_name ?? user.user_metadata.name ?? null,
      avatar_url: user.user_metadata.avatar_url ?? null,
      provider,
      onboarding_completed: false,
    },
    { onConflict: "id" },
  );

  await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
    },
    { onConflict: "user_id" },
  );

  const rules = DEFAULT_AUTOMATIONS.map((triggerType, index) => ({
    user_id: user.id,
    trigger_type: triggerType,
    is_enabled: true,
    priority: index + 1,
  }));

  await supabase.from("automation_rules").upsert(rules, {
    onConflict: "user_id,trigger_type",
  });
}

export async function listPostureHistory(limit = 20) {
  const { supabase, user } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from("posture_analysis")
    .select("*")
    .eq("user_id", user.id)
    .order("analyzed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listDailyPlans(limit = 7) {
  const { supabase, user } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("user_id", user.id)
    .order("plan_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listIntegrations() {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .order("app_name");

  if (error) throw error;
  return (data ?? []).map((item) => ({
    ...item,
    provider: item.app_name,
    last_synced_at: item.updated_at,
  }));
}

export async function upsertIntegration(provider: string, patch: Record<string, Json>) {
  const { supabase, user } = await getAuthenticatedContext();
  const integrationPayload = {
    user_id: user.id,
    app_name: provider,
    status: String(patch.status ?? "disconnected"),
    connection_id: String(patch.connection_id ?? patch.external_account_id ?? ""),
    metadata: patch.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("integrations")
    .upsert(
      integrationPayload,
      { onConflict: "user_id,app_name" },
    )
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("connected_apps").upsert(
    {
      user_id: user.id,
      provider,
      status: patch.status,
      external_account_id: patch.connection_id ?? patch.external_account_id ?? null,
      metadata: patch.metadata ?? {},
    },
    { onConflict: "user_id,provider" },
  );

  return {
    ...data,
    provider: data.app_name,
    last_synced_at: data.updated_at,
  };
}

export async function createNotification(payload: {
  channel: "gmail" | "slack" | "telegram" | "whatsapp";
  status: "queued" | "sent" | "delivered" | "failed";
  subject?: string;
  message: string;
  metadata?: Record<string, Json>;
}) {
  const { supabase, user } = await getAuthenticatedContext();

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: user.id,
      channel: payload.channel,
      status: payload.status,
      subject: payload.subject,
      message: payload.message,
      metadata: payload.metadata ?? {},
      sent_at: payload.status === "sent" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await supabase.from("reminders").insert({
    user_id: user.id,
    channel: payload.channel,
    status: payload.status,
    title: payload.subject ?? "Lembrete postural",
    message: payload.message,
    metadata: payload.metadata ?? {},
  });

  return data;
}

export async function savePostureAnalysis(payload: Record<string, Json>) {
  const { supabase, user } = await getAuthenticatedContext();
  const { data: postureSession, error: postureSessionError } = await supabase
    .from("posture_sessions")
    .insert({
      user_id: user.id,
      source_type: payload.input_mode ?? payload.source_type ?? "webcam",
      status: payload.risk_level === "high" ? "risco" : payload.risk_level === "medium" ? "atencao" : "bom",
      score: payload.score,
      context_text: payload.context_text ?? "",
      captured_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (postureSessionError) throw postureSessionError;

  const { data, error } = await supabase
    .from("posture_analysis")
    .insert({
      user_id: user.id,
      posture_session_id: postureSession.id,
      source_type: payload.input_mode ?? payload.source_type ?? "webcam",
      status: payload.risk_level === "high" ? "risco" : payload.risk_level === "medium" ? "atencao" : "bom",
      context_text: payload.context_text ?? "",
      ...payload,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { ...data, posture_session_id: postureSession.id };
}

export async function upsertCalendarInsight(payload: Record<string, Json>) {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("calendar_insights")
    .upsert(
      {
        user_id: user.id,
        ...payload,
      },
      {
        onConflict: "user_id,insight_date",
      },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function createDailyPlan(payload: Record<string, Json>) {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("daily_plans")
    .insert({
      user_id: user.id,
      ...payload,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function logAutomationRun(payload: {
  triggerType: string;
  status: "pending" | "running" | "completed" | "failed";
  automationRuleId?: string;
  payload?: Json;
  result?: Json;
  errorMessage?: string;
}) {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      user_id: user.id,
      trigger_type: payload.triggerType,
      status: payload.status,
      automation_rule_id: payload.automationRuleId,
      payload: payload.payload ?? {},
      result: payload.result ?? {},
      error_message: payload.errorMessage,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getDashboardData() {
  const [history, integrations, notifications, calendarInsight] = await Promise.all([
    listPostureHistory(4),
    listIntegrations(),
    getRecentNotifications(),
    getLatestCalendarInsight(),
  ]);

  const latest = history[0];

  return {
    latestAnalysis: latest ?? null,
    recentAnalyses: history,
    integrations,
    notifications,
    latestCalendarInsight: calendarInsight,
    score: latest?.score ?? null,
  };
}

export async function getRecentNotifications() {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

export async function getLatestCalendarInsight() {
  const { supabase, user } = await getAuthenticatedContext();
  const { data, error } = await supabase
    .from("calendar_insights")
    .select("*")
    .eq("user_id", user.id)
    .order("insight_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
