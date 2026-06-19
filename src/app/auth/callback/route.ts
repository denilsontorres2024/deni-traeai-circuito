import { NextResponse } from "next/server";

import { ensureUserSetup } from "@/lib/services/data-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/analyze";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("authError", errorDescription ?? error);
    return NextResponse.redirect(url);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const url = new URL("/login", origin);
      url.searchParams.set("authError", exchangeError.message);
      return NextResponse.redirect(url);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await ensureUserSetup(user);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
