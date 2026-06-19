import { Activity, BellRing, Link2, Sparkles } from "lucide-react";
import { AgendaSyncPanel } from "@/components/dashboard/agenda-sync-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatRelative } from "@/lib/utils";
import { getDashboardData } from "@/lib/services/data-service";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  const latest = dashboard.latestAnalysis;
  const currentMetrics = Array.isArray(latest?.metrics) ? latest.metrics : [];
  const currentRecommendations = Array.isArray(latest?.recommendations)
    ? latest.recommendations
    : [];
  const currentIssues = Array.isArray(latest?.detected_issues)
    ? latest.detected_issues
    : [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        {[
          {
            label: "Score atual",
            value: dashboard.score ?? "--",
            icon: Activity,
            hint: dashboard.latestAnalysis?.risk_level ?? "Sem analise",
          },
          {
            label: "Ultima analise",
            value: latest ? formatRelative(latest.analyzed_at) : "--",
            icon: Sparkles,
            hint: latest?.summary ?? "Abra a Analyze e inicie sua leitura postural",
          },
          {
            label: "Ultimas leituras",
            value: dashboard.recentAnalyses.length,
            icon: Activity,
            hint: "Snapshots persistidos da Analyze",
          },
          {
            label: "Integracoes",
            value: dashboard.integrations.filter((item) => item.status === "connected").length,
            icon: Link2,
            hint: "Apps conectados",
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-sm text-zinc-400">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{item.value}</p>
                <p className="mt-2 text-xs text-zinc-500">{item.hint}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10">
                <item.icon className="h-5 w-5 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Resumo da Analyze</CardTitle>
            <CardDescription>
              O dashboard reflete a ultima analise salva da webcam no Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Resumo executivo
                    </p>
                    <p className="mt-3 text-sm text-zinc-300">{latest.summary}</p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Diagnostico orientativo
                    </p>
                    <p className="mt-3 text-sm text-zinc-300">
                      {latest.diagnosis ?? "Sem diagnostico registrado ainda."}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Score", String(latest.score ?? "--")],
                    ["Risco", String(latest.risk_level ?? "--")],
                    ["Confianca", `${Number(latest.confidence ?? 0)}%`],
                    ["Capturado em", formatDate(latest.analyzed_at, "dd/MM HH:mm")],
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
                Assim que voce fizer a primeira leitura na Analyze, o dashboard passa a refletir score, risco, metricas e recomendacoes salvas no seu usuario.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risco e confianca</CardTitle>
            <CardDescription>
              Prioridade executiva da ultima leitura persistida.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Badge
              variant={
                latest?.risk_level === "high"
                  ? "danger"
                  : latest?.risk_level === "medium"
                    ? "warning"
                    : "success"
              }
            >
              {latest?.risk_level ?? "Sem risco calculado"}
            </Badge>
            <p className="text-sm text-zinc-300">
              {latest?.diagnosis ??
                "A Analyze ainda nao salvou uma leitura neste usuario."}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Confianca</span>
                <span>{latest?.confidence ?? 0}%</span>
              </div>
              <Progress value={Number(latest?.confidence ?? 0)} />
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                Agenda no dashboard
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                {dashboard.latestCalendarInsight?.summary ??
                  "Conecte e sincronize o MCP do Composio para cruzar a Analyze com sua agenda."}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <AgendaSyncPanel />

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ultimas leituras da Analyze</CardTitle>
            <CardDescription>
              Entradas persistidas pelo seu usuario autenticado, vindas diretamente da Analyze.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.recentAnalyses.length ? (
              dashboard.recentAnalyses.map((analysis) => (
                <div
                  className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                  key={analysis.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {formatDate(analysis.analyzed_at, "dd/MM/yyyy HH:mm")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Fonte {analysis.source_type}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          analysis.risk_level === "high"
                            ? "danger"
                            : analysis.risk_level === "medium"
                              ? "warning"
                              : "success"
                        }
                      >
                        {analysis.risk_level}
                      </Badge>
                      <Badge variant="neutral">Score {analysis.score}</Badge>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-zinc-300">{analysis.summary}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-400">
                Nenhuma leitura salva ainda. Abra a Analyze para gerar os primeiros dados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Desvios e recomendacoes atuais</CardTitle>
            <CardDescription>Roteamento inteligente por canal disponivel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Principais desvios
                  </p>
                  <div className="mt-4 space-y-3">
                    {currentIssues.length ? (
                      currentIssues.map((issue: string) => (
                        <p className="text-sm text-zinc-200" key={issue}>
                          {issue}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">
                        Sem desvios relevantes na ultima leitura.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Recomendacoes
                  </p>
                  <div className="mt-4 space-y-3">
                    {currentRecommendations.length ? (
                      currentRecommendations.map((item: string) => (
                        <p className="text-sm text-zinc-200" key={item}>
                          {item}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">
                        As recomendacoes aparecem aqui assim que a Analyze salvar a leitura.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/20 p-4 lg:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Metricas biomecanicas
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {currentMetrics.length ? (
                      currentMetrics.map((metric: { key: string; label: string; value: number; unit: string }) => (
                        <div
                          className="rounded-[16px] border border-white/10 bg-black/30 p-3"
                          key={metric.key}
                        >
                          <p className="text-sm text-white">{metric.label}</p>
                          <p className="mt-2 text-lg font-semibold text-emerald-300">
                            {metric.unit === "degrees"
                              ? `${metric.value.toFixed(1)}°`
                              : `${Math.round(metric.value)}%`}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-400">
                        As metricas salvas pela Analyze aparecem aqui.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                O dashboard mostra desvios, recomendacoes e metricas assim que a Analyze persistir a leitura.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Integracoes</CardTitle>
            <CardDescription>Status atual de sincronizacao dos apps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.integrations.length ? (
              dashboard.integrations.map((integration) => (
                <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/20 px-4 py-3" key={integration.id}>
                  <div>
                    <p className="text-sm text-white">{integration.provider}</p>
                    <p className="text-xs text-zinc-500">
                      {integration.last_synced_at ? formatRelative(integration.last_synced_at) : "Sem sincronizacao"}
                    </p>
                  </div>
                  <Badge
                    variant={
                      integration.status === "connected"
                        ? "success"
                        : integration.status === "connecting"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {integration.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-400">
                Conecte o MCP do Composio para sincronizar agenda e contexto do dashboard.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificacoes</CardTitle>
            <CardDescription>Roteamento inteligente por canal disponivel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboard.notifications.length ? (
              dashboard.notifications.map((notification) => (
                <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-black/20 p-4" key={notification.id}>
                  <BellRing className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <div>
                    <p className="text-sm text-white">{notification.message}</p>
                    <p className="mt-2 text-xs text-zinc-500">{notification.channel}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-zinc-400">Nenhum lembrete registrado ainda.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
