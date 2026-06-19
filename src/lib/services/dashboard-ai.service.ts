import OpenAI from "openai";

import { featureFlags, env } from "@/lib/env";
import { getCalendarContext } from "@/lib/composio";

export async function getDashboardAiInsight() {
  const calendarContext = await getCalendarContext().catch(() => null);
  const connection = calendarContext?.connection;

  if (!connection || connection.status !== "connected") {
    return {
      title: "MCP do Composio desconectado",
      summary:
        "Conecte o MCP do Composio no fluxo unico de Integrations para liberar leitura de agenda, contexto comportamental e recomendacoes de dashboard cruzadas com a analise postural.",
      actions: [
        "Abrir o MCP do Composio na aba Integrations.",
        "Concluir o login do Composio e voltar para atualizar o dashboard.",
      ],
    };
  }

  const latestInsight = calendarContext.latestInsight;
  const plans = calendarContext.plans ?? [];

  if (!featureFlags.openAiReady) {
    return {
      title: "Copiloto de agenda e postura",
      summary:
        latestInsight?.summary ??
        "MCP conectado. Assim que a agenda sincronizar, o dashboard cruza blocos de reuniao, pausas e plano ergonomico com a postura captada em tempo real.",
      actions: [
        plans[0]?.title ? `Priorize: ${plans[0].title}` : "Sincronize a agenda do dia.",
        "Faca uma nova analise para relacionar postura atual com rotina.",
      ],
    };
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Voce transforma contexto de agenda e postura em um resumo ergonomico objetivo. Responda JSON com title, summary e actions. Nao use linguagem medica.",
      },
      {
        role: "user",
        content: `Contexto atual: ${JSON.stringify({
          latestInsight,
          plans,
          connection,
        })}`,
      },
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  const parsed = JSON.parse(
    response.output_text ||
      JSON.stringify({
        title: "Copiloto de agenda e postura",
        summary:
          latestInsight?.summary ??
          "Agenda conectada. O dashboard esta pronto para transformar sua rotina em pausas, ajustes de postura e acoes ergonomicas concretas.",
        actions: ["Revisar plano do dia", "Fazer uma nova analise postural"],
      }),
  ) as {
    title?: string;
    summary?: string;
    actions?: string[];
  };

  return {
    title: parsed.title ?? "Copiloto de agenda e postura",
    summary:
      parsed.summary ??
      "Agenda conectada. O dashboard esta pronto para transformar sua rotina em pausas, ajustes de postura e acoes ergonomicas concretas.",
    actions: parsed.actions?.slice(0, 3) ?? [],
  };
}
