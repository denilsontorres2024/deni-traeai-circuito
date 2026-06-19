import Link from "next/link";
import { Activity, ShieldCheck, Sparkles } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const authError = Array.isArray(params.authError)
    ? params.authError[0]
    : params.authError ?? null;
  const highlights = [
    {
      title: "Analise real",
      description: "Webcam com MediaPipe Pose, score biomecanico e relatorio em tempo real.",
      Icon: Activity,
    },
    {
      title: "Automacao",
      description: "MCP do Composio para agenda, contexto comportamental e lembretes.",
      Icon: Sparkles,
    },
    {
      title: "Seguranca",
      description: "Auth Supabase, isolamento por usuario e RLS.",
      Icon: ShieldCheck,
    },
  ];

  return (
    <>
      <section className="flex flex-col justify-between gap-10 rounded-[36px] border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Posture AI by TRAE AI
          </p>
          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Diagnostico postural inteligente com camera, agenda e IA aplicada.
            </h1>
            <p className="max-w-2xl text-base text-zinc-300">
              Entre para acompanhar postura, rotina, pausas e recomendacoes personalizadas em um dashboard premium orientado a dados reais.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {highlights.map(({ title, description, Icon }) => (
            <div
              className="rounded-3xl border border-white/10 bg-black/20 p-4"
              key={title}
            >
              <Icon className="mb-4 h-5 w-5 text-emerald-300" />
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <Card className="self-center">
        <CardHeader>
          <CardTitle>Acesse sua conta</CardTitle>
          <CardDescription>
            Entre com email e senha para acessar seu workspace de saude postural e ergonomia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm initialError={authError} />
          <p className="text-sm text-zinc-400">
            Nao possui conta?{" "}
            <Link className="text-white hover:text-emerald-200" href="/register">
              Criar agora
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
