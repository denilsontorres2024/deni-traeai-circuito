import { fail, ok } from "@/lib/http";
import { getDashboardData } from "@/lib/services/data-service";

export async function GET() {
  try {
    return ok(await getDashboardData());
  } catch (error) {
    return fail("Falha ao carregar dashboard.", 500, String(error));
  }
}
