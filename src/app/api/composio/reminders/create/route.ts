import { fail, ok } from "@/lib/http";
import { createComposioReminder } from "@/lib/composio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message ?? "");
    const subject = body.subject ? String(body.subject) : undefined;

    if (!message) {
      return fail("Informe a mensagem do lembrete.", 400);
    }

    return ok(await createComposioReminder({ subject, message }));
  } catch (error) {
    return fail("Falha ao criar lembrete postural.", 500, String(error));
  }
}
