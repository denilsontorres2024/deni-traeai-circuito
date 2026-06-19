import { fail, ok } from "@/lib/http";
import { createComposioConnection } from "@/lib/composio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const appName = String(body.appName ?? body.provider ?? "");

    if (!appName) {
      return fail("Informe um app valido para conectar.", 400);
    }

    const origin = new URL(request.url).origin;
    const connection = await createComposioConnection(
      appName,
      `${origin}/integrations?composio=connected`,
    );

    return ok(connection);
  } catch (error) {
    return fail("Falha ao iniciar conexao Composio.", 500, String(error));
  }
}
