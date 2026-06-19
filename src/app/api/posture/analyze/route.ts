import { analyzeAndPersistPosture } from "@/lib/services/posture-analysis.service";
import { fail, ok } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    const limiter = checkRateLimit(`posture:${ip}`, 10, 60_000);

    if (!limiter.allowed) {
      return fail("Limite de analises temporariamente excedido.", 429);
    }

    const body = await request.json();
    const result = await analyzeAndPersistPosture(body);
    return ok(result);
  } catch (error) {
    return fail("Falha ao analisar postura.", 500, String(error));
  }
}
