import { fail, ok } from "@/lib/http";
import { sendComposioNotification } from "@/lib/composio";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message ?? "");
    const subject = body.subject ? String(body.subject) : undefined;

    if (!message) {
      return fail("Informe a mensagem da notificacao.", 400);
    }

    return ok(await sendComposioNotification({ subject, message }));
  } catch (error) {
    return fail("Falha ao enviar notificacao.", 500, String(error));
  }
}
