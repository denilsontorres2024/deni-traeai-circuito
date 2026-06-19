import { featureFlags } from "@/lib/env";

export const SUPPORTED_PROVIDERS = [
  "google_calendar",
  "gmail",
  "slack",
  "telegram",
  "google_sheets",
  "notion",
  "airtable",
  "twilio",
] as const;

export function getIntegrationCapability(provider: string) {
  const base = {
    provider,
    configured: featureFlags.composioReady,
    canConnect: featureFlags.composioReady,
  };

  if (!featureFlags.composioReady) {
    return {
      ...base,
      message:
        "Configure COMPOSIO_API_KEY para habilitar o handshake real de conexao com provedores externos.",
    };
  }

  return {
    ...base,
    message:
      "Backend pronto para iniciar fluxo de integracao via Composio. Ajuste as credenciais finais do workspace para executar OAuth real.",
  };
}
