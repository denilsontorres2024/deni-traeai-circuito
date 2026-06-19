import { fail, ok } from "@/lib/http";
import { syncComposioConnections } from "@/lib/composio";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appName = searchParams.get("appName") ?? undefined;

    return ok(await syncComposioConnections(appName));
  } catch (error) {
    return fail("Falha ao consultar status Composio.", 500, String(error));
  }
}
