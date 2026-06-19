import { fail, ok } from "@/lib/http";
import { getCalendarContext } from "@/lib/composio";

export async function GET() {
  try {
    return ok(await getCalendarContext());
  } catch (error) {
    return fail("Falha ao montar contexto de agenda.", 500, String(error));
  }
}
