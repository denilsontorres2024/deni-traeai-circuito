import Link from "next/link";
import {
  Activity,
  Blend,
  LayoutDashboard,
  Link2,
  Settings,
  UserCircle2,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navigation = [
  { href: "/analyze", label: "Analyze", icon: Activity },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/integrations", label: "Integrations", icon: Link2 },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  user,
}: {
  children: React.ReactNode;
  user: {
    email?: string;
    name?: string;
    avatarUrl?: string;
  };
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#04050a_0%,#09101b_50%,#06070d_100%)] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 p-4 lg:grid-cols-[260px_1fr] lg:p-6">
        <aside className="rounded-[32px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/20">
              <Blend className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-zinc-400">Posture AI</p>
              <p className="text-sm text-zinc-200">by TRAE AI</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1">
            {navigation.map((item) => (
              <Link
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm text-zinc-300 transition hover:bg-white/8 hover:text-white"
                href={item.href}
                key={item.href}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <Separator className="my-6" />

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
            <Badge variant="success">SaaS operacional</Badge>
            <p className="mt-3 text-sm text-zinc-100">
              Monitoramento postural, agenda inteligente e automacoes ergonomicas.
            </p>
          </div>
        </aside>

        <main className="rounded-[32px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl lg:p-6">
          <header className="mb-8 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-zinc-400">Workspace pessoal</p>
              <h1 className="text-2xl font-semibold text-white">Saude postural orientada a contexto real</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <p className="text-white">{user.name ?? "Usuario"}</p>
                <p className="text-zinc-400">{user.email ?? "Sem email"}</p>
              </div>
              <Avatar>
                <AvatarImage alt={user.name ?? "Avatar"} src={user.avatarUrl} />
                <AvatarFallback>{user.name?.slice(0, 1) ?? "P"}</AvatarFallback>
              </Avatar>
              <form action="/api/auth/signout" method="post">
                <Button size="sm" type="submit" variant="secondary">
                  Sair
                </Button>
              </form>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
