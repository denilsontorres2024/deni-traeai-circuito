import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { env } from "@/lib/env";
import { createClient as createCookieClient } from "@/lib/supabase/server";

function extractBearerToken(value: string | null) {
  if (!value) return null;
  if (!value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim();
}

export async function createAuthenticatedServerClient() {
  const headerStore = await headers();
  const bearerToken = extractBearerToken(
    headerStore.get("authorization") ?? headerStore.get("Authorization"),
  );

  if (!bearerToken) {
    return createCookieClient();
  }

  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
