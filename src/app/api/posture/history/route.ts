import { fail, ok } from "@/lib/http";
import { listPostureHistory } from "@/lib/services/data-service";

export async function GET() {
  try {
    return ok(await listPostureHistory());
  } catch (error) {
    return fail("Falha ao carregar historico postural.", 500, String(error));
  }
}
