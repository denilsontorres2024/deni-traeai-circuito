import OpenAI from "openai";

import { featureFlags, env } from "@/lib/env";
import {
  detectIssues,
  riskLevelFromScore,
  scoreFromMetrics,
  type ComputedPostureMetric,
  type NamedLandmark,
} from "@/lib/posture/posture-metrics";

interface InterpretationResult {
  score: number;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  diagnosis: string;
  detectedIssues: string[];
  recommendations: string[];
  exercises: string[];
  dailyPlan: string[];
  raw: Record<string, unknown>;
}

const fallbackExercises = [
  "Retrair escapulas por 45 segundos",
  "Alongar peitoral em portal por 60 segundos",
  "Mobilizar cervical com inclinacoes leves por 30 segundos",
];

export async function interpretPostureWithOpenAI(input: {
  imageBase64?: string;
  landmarks: NamedLandmark[];
  metrics: ComputedPostureMetric[];
  notes?: string;
}): Promise<InterpretationResult> {
  const score = scoreFromMetrics(input.metrics);
  const issues = detectIssues(input.metrics);
  const riskLevel = riskLevelFromScore(score);

  if (!featureFlags.openAiReady) {
    return {
      score,
      riskLevel,
      confidence: 72,
      summary:
        "Analise biomecanica concluida com interpretacao ergonomica local e pronta para ser cruzada com agenda e rotina.",
      diagnosis:
        issues.length > 0
          ? `Foram observados sinais compativeis com ${issues.join(", ").toLowerCase()}.`
          : "A postura aparenta bom alinhamento geral, com pequenos ajustes preventivos.",
      detectedIssues: issues,
      recommendations: [
        "Reorganize a altura da tela para alinhar olhos e monitor.",
        "Insira pausas ativas de 3 a 5 minutos a cada 50 minutos sentado.",
        "Mantenha apoio plantar completo e ombros relaxados durante o trabalho.",
      ],
      exercises: fallbackExercises,
      dailyPlan: [
        "Fazer 1 pausa ativa antes da proxima reuniao longa.",
        "Executar 3 minutos de mobilidade cervical e peitoral.",
        "Reavaliar postura ao final do expediente.",
      ],
      raw: {
        provider: "local-fallback",
      },
    };
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const prompt = `
Voce e um especialista em postura, ergonomia, biomecanica e produtividade.
Analise os sinais abaixo e responda em JSON puro com as chaves:
score, confidence, summary, diagnosis, detectedIssues, recommendations, exercises, dailyPlan.
Nunca substitua avaliacao medica. Seja pratico e humano.

Metricas: ${JSON.stringify(input.metrics)}
Problemas detectados localmente: ${JSON.stringify(issues)}
Observacoes do usuario: ${input.notes ?? "nenhuma"}
Quantidade de landmarks: ${input.landmarks.length}
`;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: prompt,
      },
      ...(input.imageBase64
        ? [
            {
              role: "user" as const,
              content: [
                {
                  type: "input_image" as const,
                  image_url: input.imageBase64,
                  detail: "auto" as const,
                },
              ],
            },
          ]
        : []),
    ],
    text: {
      format: {
        type: "json_object",
      },
    },
  });

  const jsonText =
    response.output_text ||
    JSON.stringify({
      score,
      confidence: 76,
      summary: "Interpretacao concluida.",
      diagnosis: "Ajuste fino necessario.",
      detectedIssues: issues,
      recommendations: [],
      exercises: fallbackExercises,
      dailyPlan: [],
    });

  const parsed = JSON.parse(jsonText) as InterpretationResult;

  return {
    score: Number(parsed.score ?? score),
    riskLevel,
    confidence: Number(parsed.confidence ?? 78),
    summary: parsed.summary,
    diagnosis: parsed.diagnosis,
    detectedIssues: parsed.detectedIssues?.length ? parsed.detectedIssues : issues,
    recommendations: parsed.recommendations ?? [],
    exercises: parsed.exercises?.length ? parsed.exercises : fallbackExercises,
    dailyPlan: parsed.dailyPlan ?? [],
    raw: parsed.raw ?? { provider: "openai" },
  };
}
