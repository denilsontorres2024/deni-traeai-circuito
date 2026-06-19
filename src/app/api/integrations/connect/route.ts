import { createComposioConnection, listComposioApps } from "@/lib/composio";
import { fail, ok } from "@/lib/http";
import { getIntegrationCapability } from "@/lib/services/composio.service";
import { upsertIntegration } from "@/lib/services/data-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider ?? "");

    if (!provider) {
      return fail("Informe um provedor valido.", 400);
    }

    const composioApp = listComposioApps().find((item) => item.appName === provider);

    if (composioApp?.configured) {
      const origin = new URL(request.url).origin;
      const connection = await createComposioConnection(provider, `${origin}/integrations`);

      return ok({
        integration: {
          provider,
          status: "connecting",
          connection_id: connection.connected_account_id,
          metadata: {
            redirectUrl: connection.redirect_url,
            expiresAt: connection.expires_at,
          },
        },
        capability: {
          provider,
          configured: true,
          canConnect: true,
          message: "Conexao Composio iniciada para este usuario.",
        },
      });
    }

    const capability = getIntegrationCapability(provider);

    const record = await upsertIntegration(provider, {
      status: capability.canConnect ? "connecting" : "error",
      metadata: capability,
    });

    return ok({
      integration: record,
      capability,
    });
  } catch (error) {
    return fail("Falha ao iniciar conexao de integracao.", 500, String(error));
  }
}
