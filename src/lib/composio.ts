import { env } from "@/lib/env";
import { sendSmartReminder } from "@/lib/services/notification-router";
import { getAuthenticatedContext, upsertIntegration } from "@/lib/services/data-service";

type ComposioAppName =
  | "google_calendar"
  | "gmail"
  | "slack"
  | "twilio"
  | "notion";

type ComposioConnectResponse = {
  link_token: string;
  redirect_url: string;
  expires_at: string;
  connected_account_id: string;
};

type ComposioConnectedAccount = {
  id: string;
  user_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  auth_config?: {
    id?: string;
  };
  data?: Record<string, unknown>;
  state?: Record<string, unknown>;
  status_reason?: string;
};

const APP_CONFIGS: Record<
  ComposioAppName,
  {
    label: string;
    authConfigId?: string;
    description: string;
    outcome: string;
  }
> = {
  google_calendar: {
    label: "Google Calendar",
    authConfigId: env.COMPOSIO_AUTH_CONFIG_GOOGLE_CALENDAR,
    description: "Le agenda, blocos de reuniao e janelas livres para pausas ergonomicas.",
    outcome: "Traduz a rotina do dia em contexto de dashboard e recomendacoes posturais.",
  },
  gmail: {
    label: "Gmail",
    authConfigId: env.COMPOSIO_AUTH_CONFIG_GMAIL,
    description: "Dispara lembretes posturais e resumos de acompanhamento por email.",
    outcome: "Mantem o usuario engajado com alertas e follow-ups automaticos.",
  },
  slack: {
    label: "Slack",
    authConfigId: env.COMPOSIO_AUTH_CONFIG_SLACK,
    description: "Entrega notificacoes de pausa e postura em canais ou DM.",
    outcome: "Leva os lembretes para o fluxo real de trabalho da equipe.",
  },
  twilio: {
    label: "Twilio / WhatsApp",
    authConfigId: env.COMPOSIO_AUTH_CONFIG_TWILIO,
    description: "Envia alertas diretos para WhatsApp quando for hora de interromper a postura fixa.",
    outcome: "Ajuda na adesao fora do dashboard, em contexto mais imediato.",
  },
  notion: {
    label: "Notion",
    authConfigId: env.COMPOSIO_AUTH_CONFIG_NOTION,
    description: "Pode registrar planos diarios, historico e rotinas ergonomicas.",
    outcome: "Organiza o plano postural em um workspace de produtividade.",
  },
};

function ensureComposioReady() {
  if (!env.COMPOSIO_API_KEY) {
    throw new Error("COMPOSIO_API_KEY is required to use Composio integrations.");
  }
}

function normalizeStatus(status: string) {
  const normalized = status.toUpperCase();

  if (normalized === "ACTIVE") return "connected";
  if (["INITIATED", "INITIALIZING", "PENDING"].includes(normalized)) {
    return "connecting";
  }
  if (["FAILED", "EXPIRED"].includes(normalized)) {
    return "error";
  }

  return "disconnected";
}

function getAppConfig(appName: string) {
  const app = APP_CONFIGS[appName as ComposioAppName];

  if (!app) {
    throw new Error(`Unsupported Composio app: ${appName}`);
  }

  if (!app.authConfigId) {
    throw new Error(`Missing auth config for ${app.label}.`);
  }

  return app;
}

async function requestComposio<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  ensureComposioReady();

  const response = await fetch(`${env.COMPOSIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.COMPOSIO_API_KEY ?? "",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as
    | T
    | {
        error?: {
          message?: string;
          suggested_fix?: string;
        };
      };

  if (!response.ok) {
    const payload = json as {
      error?: {
        message?: string;
        suggested_fix?: string;
      };
    };
    throw new Error(
      payload.error?.message ??
        payload.error?.suggested_fix ??
        "Composio request failed.",
    );
  }

  return json as T;
}

export function listComposioApps() {
  return Object.entries(APP_CONFIGS).map(([appName, config]) => ({
    appName,
    label: config.label,
    configured: Boolean(config.authConfigId),
    description: config.description,
    outcome: config.outcome,
  }));
}

export async function createComposioConnection(appName: string, callbackUrl: string) {
  const { supabase, user } = await getAuthenticatedContext();
  const app = getAppConfig(appName);

  const connection = await requestComposio<ComposioConnectResponse>(
    "/api/v3/connected_accounts/link",
    {
      method: "POST",
      body: JSON.stringify({
        auth_config_id: app.authConfigId,
        user_id: user.id,
        callback_url: callbackUrl,
      }),
    },
  );

  await supabase.from("composio_connections").upsert(
    {
      user_id: user.id,
      app_name: appName,
      auth_config_id: app.authConfigId,
      connection_id: connection.connected_account_id,
      status: "initiated",
      redirect_url: connection.redirect_url,
      metadata: {
        linkToken: connection.link_token,
        expiresAt: connection.expires_at,
      },
    },
    { onConflict: "user_id,app_name" },
  );

  await upsertIntegration(appName, {
    status: "connecting",
    connection_id: connection.connected_account_id,
    metadata: {
      redirectUrl: connection.redirect_url,
      expiresAt: connection.expires_at,
    },
  });

  return {
    appName,
    label: app.label,
    ...connection,
  };
}

export async function syncComposioConnections(appName?: string) {
  const { supabase, user } = await getAuthenticatedContext();
  const localQuery = supabase
    .from("composio_connections")
    .select("*")
    .eq("user_id", user.id);

  const { data: localConnections } = appName
    ? await localQuery.eq("app_name", appName)
    : await localQuery;

  const params = new URLSearchParams();
  params.append("user_ids", user.id);
  params.append("limit", "100");

  const response = await requestComposio<{
    items: ComposioConnectedAccount[];
  }>(`/api/v3/connected_accounts?${params.toString()}`);

  const authConfigToApp = new Map(
    Object.entries(APP_CONFIGS)
      .filter(([, config]) => config.authConfigId)
      .map(([key, config]) => [config.authConfigId as string, key]),
  );

  const connectionIdToApp = new Map(
    (localConnections ?? []).map((connection) => [
      String(connection.connection_id),
      String(connection.app_name),
    ]),
  );

  const relevantItems = response.items.filter((item) => {
    const inferredApp =
      (item.auth_config?.id ? authConfigToApp.get(item.auth_config.id) : null) ??
      connectionIdToApp.get(item.id);

    return appName ? inferredApp === appName : Boolean(inferredApp);
  });

  for (const item of relevantItems) {
    const resolvedAppName =
      (item.auth_config?.id ? authConfigToApp.get(item.auth_config.id) : null) ??
      connectionIdToApp.get(item.id);

    if (!resolvedAppName) {
      continue;
    }

    const status = normalizeStatus(item.status);

    await supabase.from("composio_connections").upsert(
      {
        user_id: user.id,
        app_name: resolvedAppName,
        auth_config_id:
          item.auth_config?.id ?? APP_CONFIGS[resolvedAppName as ComposioAppName]?.authConfigId,
        connection_id: item.id,
        status,
        metadata: {
          remoteStatus: item.status,
          reason: item.status_reason ?? null,
          data: item.data ?? {},
          state: item.state ?? {},
        },
      },
      { onConflict: "user_id,app_name" },
    );

    await upsertIntegration(resolvedAppName, {
      status,
      connection_id: item.id,
      metadata: {
        remoteStatus: item.status,
        reason: item.status_reason ?? null,
      },
    });
  }

  const { data: synced } = appName
    ? await supabase
        .from("composio_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("app_name", appName)
        .order("updated_at", { ascending: false })
    : await supabase
        .from("composio_connections")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

  return {
    apps: listComposioApps(),
    connections: synced ?? [],
  };
}

export async function getCalendarContext() {
  const { supabase, user } = await getAuthenticatedContext();
  const [{ connections }, { data: insight }, { data: plans }] = await Promise.all([
    syncComposioConnections("google_calendar"),
    supabase
      .from("calendar_insights")
      .select("*")
      .eq("user_id", user.id)
      .order("insight_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", user.id)
      .order("plan_date", { ascending: false })
      .limit(3),
  ]);

  return {
    app: "google_calendar",
    connection: connections[0] ?? null,
    latestInsight: insight ?? null,
    plans: plans ?? [],
  };
}

export async function createComposioReminder(input: {
  subject?: string;
  message: string;
}) {
  return sendSmartReminder(input);
}

export async function sendComposioNotification(input: {
  subject?: string;
  message: string;
}) {
  return sendSmartReminder(input);
}
