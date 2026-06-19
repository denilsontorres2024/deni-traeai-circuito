import { fail, ok } from "@/lib/http";
import { upsertIntegration } from "@/lib/services/data-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider = String(body.provider ?? "");

    if (!provider) {
      return fail("Informe um provedor valido.", 400);
    }

    return ok(
      await upsertIntegration(provider, {
        status: "disconnected",
        metadata: {
          disconnectedAt: new Date().toISOString(),
        },
      }),
    );
  } catch (error) {
    return fail("Falha ao desconectar integracao.", 500, String(error));
  }
}
