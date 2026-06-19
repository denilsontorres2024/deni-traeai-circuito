import { fail, ok } from "@/lib/http";
import { getAuthenticatedContext } from "@/lib/services/data-service";
import { syncCalendarInsight } from "@/lib/services/calendar-insights.service";

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("calendar_insights")
      .select("*")
      .eq("user_id", user.id)
      .order("insight_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return ok(data);
  } catch (error) {
    return fail("Falha ao recuperar insights de calendario.", 500, String(error));
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = Array.isArray(body.events) ? body.events : [];
    return ok(await syncCalendarInsight(events));
  } catch (error) {
    return fail("Falha ao consolidar insights de calendario.", 500, String(error));
  }
}
