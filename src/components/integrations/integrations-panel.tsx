"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, CalendarRange, ExternalLink, Loader2, Mail, MessageSquareMore, NotepadText, RefreshCw, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authorizedFetch, SessionExpiredError } from "@/lib/supabase/authenticated-fetch";

const providerCatalog = [
  {
    provider: "google_calendar",
    title: "Google Calendar",
    description: "Ler reunioes, blocos longos e janelas livres para pausas.",
    outcome: "Traduz a agenda em contexto comportamental para o dashboard e para a analise postural.",
    icon: CalendarRange,
  },
  {
    provider: "gmail",
    title: "Gmail",
    description: "Enviar lembretes e resumos automaticos.",
    outcome: "Mantem o usuario no fluxo real de trabalho com follow-ups ergonomicos.",
    icon: Mail,
  },
  {
    provider: "slack",
    title: "Slack",
    description: "Disparar pausas e alertas em canais ou mensagens diretas.",
    outcome: "Leva a rotina postural para o ambiente de colaboracao.",
    icon: MessageSquareMore,
  },
  {
    provider: "twilio",
    title: "Twilio / WhatsApp",
    description: "Enviar notificacoes imediatas fora do dashboard.",
    outcome: "Aumenta a adesao com lembretes no momento certo.",
    icon: Workflow,
  },
  {
    provider: "notion",
    title: "Notion",
    description: "Organizar plano diario, historico e notas de rotina.",
    outcome: "Centraliza o acompanhamento da ergonomia no workspace do usuario.",
    icon: NotepadText,
  },
] as const;

export function IntegrationsPanel({
  initial,
}: {
  initial: Array<Record<string, unknown>>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(initial);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const hasConnectedApp = useMemo(
    () => items.some((item) => item.status === "connected"),
    [items],
  );

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const response = await authorizedFetch("/api/composio/status", {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.details ?? json.error ?? "Nao foi possivel consultar o MCP do Composio.",
        );
      }

      const connections = (json.data.connections ?? []) as Array<Record<string, unknown>>;
      const integrations = connections.map((connection) => ({
        ...connection,
        provider: connection.app_name,
        status: connection.status,
      }));

      setItems((current) => {
        const map = new Map<string, Record<string, unknown>>();
        for (const item of current) {
          map.set(String(item.provider), item);
        }
        for (const item of integrations) {
          map.set(String(item.provider), item);
        }
        return Array.from(map.values());
      });
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        router.push(`/login?authError=${encodeURIComponent(error.message)}`);
        router.refresh();
        return;
      }
      setStatusError(error instanceof Error ? error.message : "Falha ao consultar o MCP.");
    } finally {
      setStatusLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (searchParams.get("composio") === "connected") {
      void refreshStatus();
    }
  }, [refreshStatus, searchParams]);

  const handleConnect = useCallback(async () => {
    setConnectLoading(true);
    setStatusError(null);

    try {
      const response = await authorizedFetch("/api/composio/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appName: "google_calendar",
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.details ??
            json.error ??
            "Nao foi possivel iniciar a conexao do MCP do Composio.",
        );
      }

      const redirectUrl = String(json.data?.redirect_url ?? "");

      if (!redirectUrl) {
        throw new Error(
          "O Composio nao retornou a URL de autorizacao. Tente novamente.",
        );
      }

      window.location.assign(redirectUrl);
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        router.push(`/login?authError=${encodeURIComponent(error.message)}`);
        router.refresh();
        return;
      }

      setStatusError(
        error instanceof Error
          ? error.message
          : "Falha ao iniciar a conexao do MCP.",
      );
    } finally {
      setConnectLoading(false);
    }
  }, [router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>MCP do Composio</CardTitle>
        <CardDescription>
          O usuario conecta em um unico lugar, no MCP do Composio, e depois a IA usa essa conexao para ler agenda, enriquecer o dashboard e cruzar rotina com postura em tempo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[28px] border border-emerald-400/20 bg-emerald-400/10 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-emerald-200">
                <Bot className="h-3.5 w-3.5" />
                MCP do Composio
              </div>
              <h2 className="text-xl font-semibold text-white">
                Conecte o MCP uma vez e libere o copiloto de agenda, postura e recomendacoes.
              </h2>
              <p className="max-w-3xl text-sm text-zinc-200">
                O login acontece no link central do Composio. Depois disso, o Posture AI usa o MCP conectado para puxar contexto da agenda, combinar com a analise captada pela camera e transformar isso em score, pausas, alertas e melhorias palpaveis no dashboard.
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200">
                Fluxo: clique em autenticar, faca login no Composio, permita os acessos e volte para sincronizar a agenda no dashboard.
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Badge variant={hasConnectedApp ? "success" : "warning"}>
                {hasConnectedApp ? "MCP ativo" : "MCP aguardando conexao"}
              </Badge>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={connectLoading}
                  onClick={() => void handleConnect()}
                  size="default"
                  type="button"
                >
                  {connectLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Autenticar com Composio
                </Button>
                <Button
                  disabled={connectLoading}
                  onClick={() => void handleConnect()}
                  size="default"
                  type="button"
                  variant="secondary"
                >
                  <CalendarRange className="h-4 w-4" />
                  Integrar Google Calendar
                </Button>
                <Button
                  disabled={statusLoading}
                  onClick={() => void refreshStatus()}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Atualizar status
                </Button>
              </div>
            </div>
          </div>
        </div>

        {statusError ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {statusError}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {providerCatalog.map((providerItem) => {
            const provider = providerItem.provider;
            const current = items.find((item) => item.provider === provider);
            const status = String(current?.status ?? "disconnected");
            const Icon = providerItem.icon;

            return (
              <div className="rounded-[28px] border border-white/10 bg-black/20 p-5" key={provider}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10">
                      <Icon className="h-5 w-5 text-emerald-300" />
                    </div>
                    <h2 className="text-base font-semibold text-white">{providerItem.title}</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {providerItem.description}
                    </p>
                    <p className="mt-2 text-xs text-zinc-500">
                      {providerItem.outcome}
                    </p>
                    <p className="mt-3 text-xs text-zinc-500">
                      {String(
                        (current?.metadata as { reason?: string } | undefined)?.reason ??
                          "Disponivel pelo MCP central do Composio depois do login unico.",
                      )}
                    </p>
                  </div>
                  <Badge
                    variant={
                      status === "connected"
                        ? "success"
                        : status === "connecting"
                          ? "warning"
                          : status === "error"
                            ? "danger"
                            : "neutral"
                    }
                  >
                    {status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
