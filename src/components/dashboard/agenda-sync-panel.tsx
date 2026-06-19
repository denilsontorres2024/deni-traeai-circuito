"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  authorizedFetch,
  SessionExpiredError,
} from "@/lib/supabase/authenticated-fetch";

type CalendarContextResponse = {
  connection?: {
    status?: string;
  } | null;
  latestInsight?: {
    summary?: string | null;
    long_meetings?: number | null;
    consecutive_meetings?: number | null;
    seated_minutes?: number | null;
    free_minutes?: number | null;
  } | null;
  plans?: Array<{
    title?: string | null;
  }>;
};

export function AgendaSyncPanel() {
  const router = useRouter();
  const [data, setData] = useState<CalendarContextResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAgenda = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await authorizedFetch("/api/composio/calendar/context", {
        cache: "no-store",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.details ?? json.error ?? "Nao foi possivel carregar a agenda.",
        );
      }

      setData((json.data ?? null) as CalendarContextResponse | null);
    } catch (caughtError) {
      if (caughtError instanceof SessionExpiredError) {
        router.push(`/login?authError=${encodeURIComponent(caughtError.message)}`);
        router.refresh();
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Nao foi possivel carregar a agenda.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refreshAgenda();
  }, [refreshAgenda]);

  const connectionStatus = data?.connection?.status ?? "disconnected";
  const latestInsight = data?.latestInsight;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda conectada ao dashboard</CardTitle>
        <CardDescription>
          Carrega informacoes da sua agenda depois que a tela abre, sem bloquear a navegacao.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10">
              <CalendarRange className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-sm text-white">Google Calendar via MCP</p>
              <p className="text-xs text-zinc-500">
                {connectionStatus === "connected"
                  ? "Conexao ativa para puxar reunioes e contexto do dia."
                  : "Conecte o MCP na aba Integrations para habilitar sua agenda."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                connectionStatus === "connected"
                  ? "success"
                  : connectionStatus === "connecting"
                    ? "warning"
                    : "neutral"
              }
            >
              {connectionStatus}
            </Badge>
            <Button
              disabled={loading}
              onClick={() => void refreshAgenda()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-[20px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {latestInsight ? (
          <>
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-zinc-200">
                {latestInsight.summary ??
                  "A agenda foi conectada e esta pronta para enriquecer o dashboard."}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Reunioes longas", String(latestInsight.long_meetings ?? 0)],
                ["Reunioes consecutivas", String(latestInsight.consecutive_meetings ?? 0)],
                ["Minutos sentado", String(latestInsight.seated_minutes ?? 0)],
                ["Minutos livres", String(latestInsight.free_minutes ?? 0)],
              ].map(([label, value]) => (
                <div
                  className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                  key={label}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    {label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
            Assim que o MCP sincronizar sua agenda, este bloco mostra reunioes longas,
            blocos consecutivos e janelas livres para pausas ergonomicas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
