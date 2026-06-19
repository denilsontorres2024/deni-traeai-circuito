"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export class SessionExpiredError extends Error {
  constructor(message = "Sua sessão expirou. Faça login novamente.") {
    super(message);
    this.name = "SessionExpiredError";
  }
}

export async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new SessionExpiredError();
  }

  return session.access_token;
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
