import { fail, ok } from "@/lib/http";
import { getAuthenticatedContext } from "@/lib/services/data-service";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return ok(data ?? []);
  } catch (error) {
    return fail("Falha ao carregar historico de automacoes.", 500, String(error));
  }
}
