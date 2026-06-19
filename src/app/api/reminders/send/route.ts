import { fail, ok } from "@/lib/http";
import { sendSmartReminder } from "@/lib/services/notification-router";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.message) {
      return fail("Informe a mensagem do lembrete.", 400);
    }

    return ok(
      await sendSmartReminder({
        subject: body.subject,
        message: body.message,
      }),
    );
  } catch (error) {
    return fail("Falha ao enviar lembrete.", 500, String(error));
  }
}
