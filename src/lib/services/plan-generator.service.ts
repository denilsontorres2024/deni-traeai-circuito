import { addDays, formatISO } from "date-fns";

import { createDailyPlan } from "@/lib/services/data-service";

export function buildDailyPlan(input: {
  score: number;
  riskLevel: "low" | "medium" | "high";
  issues: string[];
  freeMinutes?: number;
  consecutiveMeetings?: number;
}) {
  const blocks = [
    {
      label: "Ajuste de setup",
      durationMinutes: 5,
      description: "Ajuste altura da tela, apoio plantar e posicao dos ombros.",
    },
    {
      label: "Pausa ativa",
      durationMinutes: input.riskLevel === "high" ? 8 : 5,
      description: "Mobilidade cervical, peitoral e extensao toracica.",
    },
  ];

  if ((input.consecutiveMeetings ?? 0) >= 3) {
    blocks.push({
      label: "Descompressao entre reunioes",
      durationMinutes: 4,
      description: "Caminhada curta e retracao escapular antes do proximo bloco.",
    });
  }

  if ((input.freeMinutes ?? 0) > 120) {
    blocks.push({
      label: "Rotina completa",
      durationMinutes: 15,
      description: "Sequencia guiada de mobilidade e fortalecimento leve.",
    });
  }

  return {
    title:
      input.score < 70
        ? "Plano corretivo do dia"
        : "Plano preventivo do dia",
    summary:
      input.issues.length > 0
        ? `Foco em ${input.issues.slice(0, 2).join(" e ").toLowerCase()}.`
        : "Manutencao preventiva com pausas e reorganizacao ergonomica.",
    priority: input.riskLevel,
    blocks,
  };
}

export async function persistDailyPlan(input: {
  score: number;
  riskLevel: "low" | "medium" | "high";
  issues: string[];
  freeMinutes?: number;
  consecutiveMeetings?: number;
  postureAnalysisId?: string;
}) {
  const plan = buildDailyPlan(input);

  return createDailyPlan({
    posture_analysis_id: input.postureAnalysisId ?? null,
    plan_date: formatISO(addDays(new Date(), 0), { representation: "date" }),
    title: plan.title,
    summary: plan.summary,
    priority: plan.priority,
    blocks: plan.blocks,
  });
}
