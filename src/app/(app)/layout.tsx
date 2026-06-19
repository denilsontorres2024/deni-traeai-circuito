import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell
      user={{
        email: user.email,
        name: user.user_metadata.full_name ?? user.user_metadata.name ?? "Usuario",
        avatarUrl: user.user_metadata.avatar_url,
      }}
    >
      {children}
    </AppShell>
  );
}
