"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Pause,
  Play,
  RefreshCcw,
  ScanLine,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeVideoFrame,
  disposePoseLandmarker,
  validateVideoFrame,
  waitForVideoReady,
} from "@/lib/mediapipe/pose";
import {
  computePostureMetrics,
  detectIssues,
  recommendationsFromMetrics,
  riskLevelFromScore,
  scoreFromMetrics,
  type ComputedPostureMetric,
  type NamedLandmark,
} from "@/lib/posture/posture-metrics";
import {
  authorizedFetch,
  SessionExpiredError,
} from "@/lib/supabase/authenticated-fetch";

type WebcamState =
  | "permission"
  | "connecting"
  | "active"
  | "paused"
  | "error"
  | "unavailable";

type BodyPoint = {
  x: number;
  y: number;
};

type CalibrationSnapshot = {
  capturedAt: string;
  score: number;
  metrics: Record<string, number>;
  cervicalAngle: number;
  trunkAngle: number;
  shoulderAsymmetry: number;
  hipAsymmetry: number;
  alignment: number;
};

type PersistedAnalysis = {
  score: number;
  riskLevel: "low" | "medium" | "high";
  status: "bom" | "atencao" | "risco";
  confidence: number;
  summary: string;
  diagnosis: string;
  detectedIssues: string[];
  recommendations: string[];
  exercises: string[];
  dailyPlan: string[];
  metrics: ComputedPostureMetric[];
  landmarks: NamedLandmark[];
  analyzedAt: string;
  contextText: string;
};

type AnalyzeResponse = {
  analysis?: Record<string, unknown>;
  [key: string]: unknown;
};

type LiveAnalysis = {
  score: number;
  status: "bom" | "atencao" | "risco";
  riskLevel: "low" | "medium" | "high";
  metrics: ComputedPostureMetric[];
  landmarks: NamedLandmark[];
  deviations: string[];
  recommendations: string[];
  cervicalAngle: number;
  trunkAngle: number;
  shoulderAsymmetry: number;
  hipAsymmetry: number;
  alignment: number;
  stability: number;
  confidence: number;
  quality: string;
  fps: number;
  resolution: string;
  landmarkCount: number;
  centerOfMass: BodyPoint;
  executiveSummary: string;
  actionPlan: Array<{ time: string; title: string; rationale: string }>;
  calibratedDrift: Array<{ label: string; delta: number }>;
};

const BODY_CONNECTIONS: Array<[string, string]> = [
  ["nose", "left_ear"],
  ["nose", "right_ear"],
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_shoulder", "left_hip"],
  ["right_shoulder", "right_hip"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
];

const CAMERA_MESSAGES = {
  initial: "Tentando acessar sua camera.",
  permission:
    "Precisamos da sua autorizacao para acessar a camera e iniciar a analise postural em tempo real.",
  active: "Analise postural em tempo real online.",
  paused: "Analise pausada. Retome a camera para continuar monitorando.",
  reconnecting: "Reconectando a camera automaticamente.",
  guidance:
    "Mantenha cabeca, ombros, quadril, joelhos e tornozelos visiveis para estabilizar a leitura.",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function statusFromScore(score: number): "bom" | "atencao" | "risco" {
  if (score < 50) return "risco";
  if (score < 70) return "atencao";
  return "bom";
}

function classificationFromScore(score: number) {
  if (score >= 85) {
    return {
      label: "Excelente",
      description: "Alinhamento consistente e risco biomecanico baixo.",
      variant: "success" as const,
    };
  }
  if (score >= 70) {
    return {
      label: "Bom",
      description: "A postura esta funcional, com ajustes preventivos pontuais.",
      variant: "success" as const,
    };
  }
  if (score >= 50) {
    return {
      label: "Atencao",
      description: "Compensacoes relevantes ja aparecem no padrao corporal.",
      variant: "warning" as const,
    };
  }
  return {
    label: "Critico",
    description: "Os desvios atuais pedem ajuste imediato no setup e na rotina.",
    variant: "danger" as const,
  };
}

function riskLabel(riskLevel: "low" | "medium" | "high") {
  if (riskLevel === "high") return "Alto";
  if (riskLevel === "medium") return "Medio";
  return "Baixo";
}

function badgeVariantFromStatus(status: "bom" | "atencao" | "risco") {
  if (status === "risco") return "danger" as const;
  if (status === "atencao") return "warning" as const;
  return "success" as const;
}

function badgeVariantFromSeverity(severity: "low" | "medium" | "high") {
  if (severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "success" as const;
}

function formatMetricValue(metric: ComputedPostureMetric) {
  if (metric.unit === "degrees") {
    return `${metric.value.toFixed(1)}°`;
  }

  return `${Math.round(metric.value)}%`;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asMetrics(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((metric): metric is ComputedPostureMetric => {
    return Boolean(
      metric &&
        typeof metric === "object" &&
        "key" in metric &&
        "label" in metric &&
        "value" in metric &&
        "unit" in metric &&
        "severity" in metric,
    );
  });
}

function asLandmarks(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.filter((landmark): landmark is NamedLandmark => {
    return Boolean(
      landmark &&
        typeof landmark === "object" &&
        "name" in landmark &&
        "x" in landmark &&
        "y" in landmark,
    );
  });
}

function normalizeAnalysis(analysis?: Record<string, unknown> | null) {
  if (!analysis || typeof analysis.score !== "number") {
    return null;
  }

  const score = analysis.score;
  const riskLevel =
    analysis.risk_level === "high" ||
    analysis.risk_level === "medium" ||
    analysis.risk_level === "low"
      ? analysis.risk_level
      : riskLevelFromScore(score);

  const status =
    analysis.status === "bom" ||
    analysis.status === "atencao" ||
    analysis.status === "risco"
      ? analysis.status
      : statusFromScore(score);

  return {
    score,
    riskLevel,
    status,
    confidence:
      typeof analysis.confidence === "number" ? analysis.confidence : 0,
    summary: typeof analysis.summary === "string" ? analysis.summary : "",
    diagnosis: typeof analysis.diagnosis === "string" ? analysis.diagnosis : "",
    detectedIssues: asStringArray(analysis.detected_issues),
    recommendations: asStringArray(analysis.recommendations),
    exercises: asStringArray(analysis.exercises),
    dailyPlan: asStringArray(analysis.daily_plan),
    metrics: asMetrics(analysis.metrics),
    landmarks: asLandmarks(analysis.landmarks),
    analyzedAt:
      typeof analysis.analyzed_at === "string"
        ? analysis.analyzed_at
        : new Date().toISOString(),
    contextText:
      typeof analysis.context_text === "string" ? analysis.context_text : "",
  } satisfies PersistedAnalysis;
}

function logCameraError(
  stage: string,
  error: unknown,
  extras: Record<string, unknown> = {},
) {
  console.error(`[PostureAI][camera][${stage}]`, {
    error,
    ...extras,
  });
}

function getCameraErrorDetails(error: unknown) {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return {
        state: "error" as const,
        message:
          "Nao foi possivel iniciar a camera. Abra a aplicacao em um ambiente HTTPS para continuar.",
        shouldRetry: false,
      };
    }
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return {
          state: "error" as const,
          message:
            "O acesso a camera foi bloqueado. Autorize a camera nas configuracoes do navegador.",
          shouldRetry: false,
        };
      case "NotFoundError":
      case "DevicesNotFoundError":
        return {
          state: "unavailable" as const,
          message: "Nenhuma camera foi encontrada neste dispositivo.",
          shouldRetry: false,
        };
      case "NotReadableError":
      case "TrackStartError":
      case "AbortError":
        return {
          state: "error" as const,
          message: "Nao foi possivel iniciar a camera.",
          shouldRetry: true,
        };
      default:
        return {
          state: "error" as const,
          message: "Nao foi possivel iniciar a camera.",
          shouldRetry: true,
        };
    }
  }

  return {
    state: "error" as const,
    message: "Nao foi possivel iniciar a camera.",
    shouldRetry: true,
  };
}

function toMap(landmarks: NamedLandmark[]) {
  return new Map(landmarks.map((landmark) => [landmark.name, landmark]));
}

function getLandmark(map: Map<string, NamedLandmark>, name: string) {
  const landmark = map.get(name);

  if (!landmark) {
    throw new Error(`Landmark ausente: ${name}`);
  }

  return landmark;
}

function midpoint(a: NamedLandmark, b: NamedLandmark): BodyPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function pointDistance(a: BodyPoint, b: BodyPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleFromHorizontal(a: BodyPoint, b: BodyPoint) {
  return Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
}

function angleFromVertical(top: BodyPoint, bottom: BodyPoint) {
  return Math.abs(
    (Math.atan2(bottom.x - top.x, bottom.y - top.y) * 180) / Math.PI,
  );
}

function visibilityAverage(landmarks: NamedLandmark[]) {
  if (!landmarks.length) return 0;

  const total = landmarks.reduce(
    (sum, landmark) =>
      sum + (typeof landmark.visibility === "number" ? landmark.visibility : 0.6),
    0,
  );

  return clamp((total / landmarks.length) * 100, 0, 100);
}

function qualityLabel(confidence: number) {
  if (confidence >= 85) return "Alta";
  if (confidence >= 65) return "Moderada";
  return "Baixa";
}

function metricLookup(metrics: ComputedPostureMetric[], key: string) {
  return metrics.find((metric) => metric.key === key)?.value ?? 0;
}

function buildSmartRecommendations(
  metrics: ComputedPostureMetric[],
  cervicalAngle: number,
  trunkAngle: number,
  shoulderAsymmetry: number,
  stability: number,
) {
  const recommendations = recommendationsFromMetrics(metrics).map(
    (item) => `${item.title}: ${item.description}`,
  );

  if (cervicalAngle >= 10) {
    recommendations.unshift(
      "Corrigir alinhamento cervical: eleve a tela para manter os olhos no centro do monitor e reduza a anteriorizacao da cabeca.",
    );
  }

  if (trunkAngle >= 8) {
    recommendations.push(
      "Ajustar inclinacao do tronco: aproxime a cadeira da mesa e mantenha o torax alinhado sobre o quadril.",
    );
  }

  if (shoulderAsymmetry >= 4) {
    recommendations.push(
      "Corrigir posicionamento dos ombros: nivele apoio de bracos, teclado e mouse para reduzir a elevacao assimetrica.",
    );
  }

  if (stability < 70) {
    recommendations.push(
      "Levantar para pausa ativa: reduza movimentos compensatorios, apoie os pes e estabilize a base antes da proxima leitura.",
    );
  }

  return Array.from(new Set(recommendations)).slice(0, 5);
}

function buildDailyPlan(
  recommendations: string[],
  context: string,
  score: number,
  savedPlan: string[] = [],
) {
  const entries = savedPlan.length
    ? savedPlan
    : recommendations.length
      ? recommendations
      : [
          "Ajustar a altura do monitor e recentralizar a cabeca.",
          "Realizar pausa ergonomica com retracao escapular.",
          "Executar mobilidade toracica e cervical leve.",
          "Revisar postura sentada antes de encerrar o expediente.",
        ];

  const baseHour = Math.max(new Date().getHours() + 1, 8);
  const offsets = [0, 2, 4, 6];

  return entries.slice(0, 4).map((entry, index) => ({
    time: `${String((baseHour + offsets[index]) % 24).padStart(2, "0")}:00`,
    title: entry,
    rationale:
      score < 70
        ? "Priorizado porque o score atual pede correcao postural recorrente."
        : context
          ? "Alinhado ao contexto informado e a rotina atual."
          : "Gerado automaticamente a partir da leitura biomecanica em tempo real.",
  }));
}

function buildExecutiveSummary(
  score: number,
  riskLevel: "low" | "medium" | "high",
  cervicalAngle: number,
  trunkAngle: number,
) {
  if (riskLevel === "high") {
    return `Score ${score}/100 com risco alto. A leitura mostra sobrecarga relevante em cervical (${cervicalAngle.toFixed(
      1,
    )}°) e tronco (${trunkAngle.toFixed(
      1,
    )}°), indicando necessidade de ajuste imediato no setup.`;
  }

  if (riskLevel === "medium") {
    return `Score ${score}/100 com risco medio. Ha compensacoes moderadas em cervical (${cervicalAngle.toFixed(
      1,
    )}°) e tronco (${trunkAngle.toFixed(
      1,
    )}°), recomendando correcoes preventivas ao longo do dia.`;
  }

  return `Score ${score}/100 com risco baixo. O alinhamento corporal esta estavel, com pequenas variacoes em cervical (${cervicalAngle.toFixed(
    1,
  )}°) e tronco (${trunkAngle.toFixed(1)}°).`;
}

function toCanvasPoint(point: BodyPoint, width: number, height: number) {
  return {
    x: point.x * width,
    y: point.y * height,
  };
}

function drawLine(
  context: CanvasRenderingContext2D,
  start: BodyPoint,
  end: BodyPoint,
  width: number,
  height: number,
  color: string,
  lineWidth: number,
) {
  const from = toCanvasPoint(start, width, height);
  const to = toCanvasPoint(end, width, height);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function drawLabel(
  context: CanvasRenderingContext2D,
  text: string,
  point: BodyPoint,
  width: number,
  height: number,
) {
  const { x, y } = toCanvasPoint(point, width, height);
  context.fillStyle = "rgba(2, 6, 23, 0.72)";
  context.fillRect(x + 10, y - 22, context.measureText(text).width + 12, 20);
  context.fillStyle = "rgba(240, 253, 250, 0.96)";
  context.fillText(text, x + 16, y - 8);
}

function drawOverlay(
  canvas: HTMLCanvasElement | null,
  landmarks: NamedLandmark[],
  analysis: LiveAnalysis,
  video: HTMLVideoElement | null,
) {
  if (!canvas || !video) return;

  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) return;

  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.font = "12px sans-serif";

  const landmarkMap = toMap(landmarks);

  for (const [from, to] of BODY_CONNECTIONS) {
    const start = landmarkMap.get(from);
    const end = landmarkMap.get(to);

    if (!start || !end) continue;

    drawLine(
      context,
      start,
      end,
      width,
      height,
      "rgba(45, 212, 191, 0.7)",
      3,
    );
  }

  const leftShoulder = landmarkMap.get("left_shoulder");
  const rightShoulder = landmarkMap.get("right_shoulder");
  const leftHip = landmarkMap.get("left_hip");
  const rightHip = landmarkMap.get("right_hip");

  if (leftShoulder && rightShoulder) {
    drawLine(
      context,
      leftShoulder,
      rightShoulder,
      width,
      height,
      "rgba(34, 197, 94, 0.95)",
      4,
    );
    drawLabel(
      context,
      `Ombros ${analysis.shoulderAsymmetry.toFixed(1)}°`,
      midpoint(leftShoulder, rightShoulder),
      width,
      height,
    );
  }

  if (leftHip && rightHip) {
    drawLine(
      context,
      leftHip,
      rightHip,
      width,
      height,
      "rgba(249, 115, 22, 0.95)",
      4,
    );
    drawLabel(
      context,
      `Quadril ${analysis.hipAsymmetry.toFixed(1)}°`,
      midpoint(leftHip, rightHip),
      width,
      height,
    );
  }

  drawLine(
    context,
    { x: analysis.centerOfMass.x, y: 0.08 },
    { x: analysis.centerOfMass.x, y: 0.94 },
    width,
    height,
    "rgba(59, 130, 246, 0.9)",
    2.5,
  );

  const center = toCanvasPoint(analysis.centerOfMass, width, height);
  context.fillStyle = "rgba(250, 204, 21, 0.95)";
  context.beginPath();
  context.arc(center.x, center.y, 7, 0, Math.PI * 2);
  context.fill();

  for (const landmark of landmarks) {
    const point = toCanvasPoint(landmark, width, height);
    context.fillStyle = "rgba(16, 185, 129, 0.95)";
    context.strokeStyle = "rgba(2, 6, 23, 0.9)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(point.x, point.y, 4.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  drawLabel(
    context,
    `Cervical ${analysis.cervicalAngle.toFixed(1)}°`,
    { x: clamp(analysis.centerOfMass.x + 0.03, 0.08, 0.88), y: 0.18 },
    width,
    height,
  );
  drawLabel(
    context,
    `Tronco ${analysis.trunkAngle.toFixed(1)}°`,
    { x: clamp(analysis.centerOfMass.x + 0.03, 0.08, 0.88), y: 0.3 },
    width,
    height,
  );
}

function buildLiveAnalysis(
  landmarks: NamedLandmark[],
  metrics: ComputedPostureMetric[],
  fps: number,
  resolution: string,
  stability: number,
  calibration: CalibrationSnapshot | null,
  notes: string,
) {
  const landmarkMap = toMap(landmarks);
  const leftShoulder = getLandmark(landmarkMap, "left_shoulder");
  const rightShoulder = getLandmark(landmarkMap, "right_shoulder");
  const leftHip = getLandmark(landmarkMap, "left_hip");
  const rightHip = getLandmark(landmarkMap, "right_hip");
  const nose = getLandmark(landmarkMap, "nose");

  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const centerOfMass = {
    x: (shoulderMid.x + hipMid.x) / 2,
    y: (shoulderMid.y + hipMid.y) / 2,
  };
  const score = scoreFromMetrics(metrics);
  const riskLevel = riskLevelFromScore(score);
  const confidence = round(visibilityAverage(landmarks), 0);
  const shoulderAsymmetry = round(angleFromHorizontal(leftShoulder, rightShoulder));
  const hipAsymmetry = round(angleFromHorizontal(leftHip, rightHip));
  const cervicalAngle = round(angleFromVertical(nose, shoulderMid));
  const trunkAngle = round(angleFromVertical(shoulderMid, hipMid));
  const alignmentPenalty =
    metricLookup(metrics, "shoulder_alignment") * 0.24 +
    metricLookup(metrics, "hip_alignment") * 0.22 +
    metricLookup(metrics, "body_symmetry") * 0.22 +
    trunkAngle * 1.8 +
    cervicalAngle * 1.6;
  const alignment = round(clamp(100 - alignmentPenalty, 0, 100), 0);
  const deviations = detectIssues(metrics);

  if (trunkAngle >= 8 && !deviations.includes("Inclinacao do tronco")) {
    deviations.push("Inclinacao do tronco");
  }
  if (
    cervicalAngle >= 10 &&
    !deviations.includes("Alinhamento cervical comprometido")
  ) {
    deviations.push("Alinhamento cervical comprometido");
  }

  const recommendations = buildSmartRecommendations(
    metrics,
    cervicalAngle,
    trunkAngle,
    shoulderAsymmetry,
    stability,
  );

  const calibratedDrift = calibration
    ? metrics
        .map((metric) => ({
          label: metric.label,
          delta: round(metric.value - (calibration.metrics[metric.key] ?? metric.value)),
        }))
        .filter((metric) => Math.abs(metric.delta) >= 2)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
        .slice(0, 4)
    : [];

  return {
    score,
    status: statusFromScore(score),
    riskLevel,
    metrics,
    landmarks,
    deviations,
    recommendations,
    cervicalAngle,
    trunkAngle,
    shoulderAsymmetry,
    hipAsymmetry,
    alignment,
    stability: round(stability, 0),
    confidence,
    quality: qualityLabel(confidence),
    fps: round(fps, 1),
    resolution,
    landmarkCount: landmarks.length,
    centerOfMass,
    executiveSummary: buildExecutiveSummary(
      score,
      riskLevel,
      cervicalAngle,
      trunkAngle,
    ),
    actionPlan: buildDailyPlan(recommendations, notes, score),
    calibratedDrift,
  } satisfies LiveAnalysis;
}

function EvidenceOverlay({
  imageSrc,
  landmarks,
}: {
  imageSrc: string;
  landmarks: NamedLandmark[];
}) {
  const landmarkMap = useMemo(() => toMap(landmarks), [landmarks]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
      <NextImage
        alt="Frame salvo da analise"
        className="object-cover"
        fill
        src={imageSrc}
        unoptimized
      />
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {BODY_CONNECTIONS.map(([from, to]) => {
          const start = landmarkMap.get(from);
          const end = landmarkMap.get(to);

          if (!start || !end) return null;

          return (
            <line
              key={`${from}-${to}`}
              stroke="rgba(45, 212, 191, 0.82)"
              strokeWidth="0.7"
              x1={start.x * 100}
              x2={end.x * 100}
              y1={start.y * 100}
              y2={end.y * 100}
            />
          );
        })}
        {landmarks.map((landmark) => (
          <circle
            key={landmark.name}
            cx={landmark.x * 100}
            cy={landmark.y * 100}
            fill="rgba(16, 185, 129, 0.96)"
            r="0.8"
            stroke="rgba(2, 6, 23, 0.9)"
            strokeWidth="0.25"
          />
        ))}
      </svg>
    </div>
  );
}

export function CameraCapture() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const autoPersistTimeoutRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);
  const lastPersistedKeyRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const lastAnalyzedAtRef = useRef(0);
  const lastFrameAtRef = useRef(0);
  const stabilityRef = useRef(100);
  const latestAnalysisRef = useRef<LiveAnalysis | null>(null);
  const lastCoreRef = useRef<{
    shoulder: BodyPoint;
    hip: BodyPoint;
    nose: BodyPoint;
  } | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCameraPaused, setIsCameraPaused] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState(CAMERA_MESSAGES.initial);
  const [webcamState, setWebcamState] = useState<WebcamState>("permission");
  const [liveAnalysis, setLiveAnalysis] = useState<LiveAnalysis | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<PersistedAnalysis | null>(
    null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [calibration, setCalibration] = useState<CalibrationSnapshot | null>(
    null,
  );

  const sortedDevices = useMemo(
    () => devices.filter((device) => device.kind === "videoinput"),
    [devices],
  );
  const visibleAnalysis = liveAnalysis ?? latestAnalysisRef.current;
  const classification = visibleAnalysis
    ? classificationFromScore(visibleAnalysis.score)
    : null;
  const visibleRecommendations =
    savedAnalysis?.recommendations.length && visibleAnalysis
      ? savedAnalysis.recommendations
      : visibleAnalysis?.recommendations ?? [];
  const visiblePlan = visibleAnalysis
    ? buildDailyPlan(
        visibleRecommendations,
        savedAnalysis?.contextText || notes,
        visibleAnalysis.score,
        savedAnalysis?.dailyPlan,
      )
    : [];
  const visibleExercises = savedAnalysis?.exercises.length
    ? savedAnalysis.exercises
    : visibleRecommendations
        .filter(
          (item) => item.includes("mobilidade") || item.includes("alongamento"),
        )
        .slice(0, 3);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    const context = overlayCanvasRef.current?.getContext("2d");
    const canvas = overlayCanvasRef.current;
    if (context && canvas) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const redirectToLogin = useCallback(
    (message: string) => {
      router.push(`/login?authError=${encodeURIComponent(message)}`);
      router.refresh();
    },
    [router],
  );

  const persistCurrentAnalysis = useCallback(
    async ({
      silent = false,
      force = false,
    }: {
      silent?: boolean;
      force?: boolean;
    } = {}) => {
      if (
        !videoRef.current ||
        !captureCanvasRef.current ||
        !visibleAnalysis ||
        !validateVideoFrame(videoRef.current)
      ) {
        if (!silent) {
          setError("Aguarde uma leitura valida antes de salvar o relatorio.");
        }
        return;
      }

      const persistKey = JSON.stringify({
        score: Math.round(visibleAnalysis.score),
        cervical: Math.round(visibleAnalysis.cervicalAngle),
        trunk: Math.round(visibleAnalysis.trunkAngle),
        shoulder: Math.round(visibleAnalysis.shoulderAsymmetry),
        hip: Math.round(visibleAnalysis.hipAsymmetry),
        notes,
      });

      const now = Date.now();
      if (
        !force &&
        lastPersistedKeyRef.current === persistKey &&
        now - lastPersistedAtRef.current < 20_000
      ) {
        return;
      }

      const canvas = captureCanvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext("2d");

      if (!context) {
        if (!silent) {
          setError("Nao foi possivel salvar o relatorio atual.");
        }
        return;
      }

      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.92);

      setIsSaving(true);
      if (!silent) {
        setError(null);
      }

      try {
        const response = await authorizedFetch("/api/posture/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "webcam",
            imageBase64,
            landmarks: visibleAnalysis.landmarks,
            metrics: visibleAnalysis.metrics,
            notes,
          }),
        });

        const json = (await response.json()) as {
          data?: AnalyzeResponse;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(json.error ?? "Falha ao salvar a analise.");
        }

        const normalized = normalizeAnalysis(json.data?.analysis ?? null);
        setPreview(imageBase64);
        setSavedAnalysis(normalized);
        lastPersistedAtRef.current = now;
        lastPersistedKeyRef.current = persistKey;

        if (!silent) {
          setStatusMessage("Relatorio executivo salvo com sucesso.");
        }
      } catch (caughtError) {
        if (caughtError instanceof SessionExpiredError) {
          redirectToLogin(caughtError.message);
          return;
        }

        if (!silent) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Nao foi possivel salvar a analise.",
          );
        }
      } finally {
        setIsSaving(false);
      }
    },
    [notes, redirectToLogin, visibleAnalysis],
  );

  const startWebcamLoop = useCallback(() => {
    if (!videoRef.current || isCameraPaused) return;

    const loop = async () => {
      const video = videoRef.current;
      if (!video || isCameraPaused) return;

      if (!validateVideoFrame(video)) {
        rafRef.current = window.requestAnimationFrame(() => {
          void loop();
        });
        return;
      }

      const now = performance.now();
      if (isProcessingRef.current || now - lastAnalyzedAtRef.current < 33) {
        rafRef.current = window.requestAnimationFrame(() => {
          void loop();
        });
        return;
      }

      isProcessingRef.current = true;
      lastAnalyzedAtRef.current = now;

      try {
        const landmarks = await analyzeVideoFrame(video, now);
        const metrics = computePostureMetrics(landmarks);
        const resolution = `${video.videoWidth} x ${video.videoHeight}`;
        const fps =
          lastFrameAtRef.current > 0 ? 1000 / (now - lastFrameAtRef.current) : 0;
        lastFrameAtRef.current = now;

        const landmarkMap = toMap(landmarks);
        const shoulder = midpoint(
          getLandmark(landmarkMap, "left_shoulder"),
          getLandmark(landmarkMap, "right_shoulder"),
        );
        const hip = midpoint(
          getLandmark(landmarkMap, "left_hip"),
          getLandmark(landmarkMap, "right_hip"),
        );
        const nose = getLandmark(landmarkMap, "nose");

        if (lastCoreRef.current) {
          const movement =
            (pointDistance(shoulder, lastCoreRef.current.shoulder) +
              pointDistance(hip, lastCoreRef.current.hip) +
              pointDistance(nose, lastCoreRef.current.nose)) /
            3;
          const instantStability = clamp(100 - movement * 1200, 0, 100);
          stabilityRef.current = clamp(
            stabilityRef.current * 0.72 + instantStability * 0.28,
            0,
            100,
          );
        } else {
          stabilityRef.current = 100;
        }

        lastCoreRef.current = { shoulder, hip, nose };

        const nextAnalysis = buildLiveAnalysis(
          landmarks,
          metrics,
          fps,
          resolution,
          stabilityRef.current,
          calibration,
          notes,
        );

        latestAnalysisRef.current = nextAnalysis;
        setLiveAnalysis(nextAnalysis);
        setWebcamState("active");
        setStatusMessage(CAMERA_MESSAGES.active);
        setError(null);
        drawOverlay(overlayCanvasRef.current, landmarks, nextAnalysis, video);
      } catch (caughtError) {
        setStatusMessage(CAMERA_MESSAGES.guidance);
        logCameraError("frame", caughtError, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      } finally {
        isProcessingRef.current = false;
        rafRef.current = window.requestAnimationFrame(() => {
          void loop();
        });
      }
    };

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = window.requestAnimationFrame(() => {
      void loop();
    });
  }, [calibration, isCameraPaused, notes]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamState("unavailable");
      setStatusMessage("Nenhuma camera foi encontrada neste dispositivo.");
      setError("Nenhuma camera foi encontrada neste dispositivo.");
      return;
    }

    if (!deviceId && !sortedDevices.length) {
      setWebcamState("unavailable");
      setStatusMessage("Nenhuma camera foi encontrada neste dispositivo.");
      setError("Nenhuma camera foi encontrada neste dispositivo.");
      return;
    }

    stopCamera();
    setError(null);
    setWebcamState("connecting");
    setStatusMessage("Conectando camera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? {
              deviceId: { exact: deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      });

      if (!videoRef.current) {
        return;
      }

      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      await waitForVideoReady(videoRef.current);
      await videoRef.current.play();

      setHasCameraPermission(true);
      setWebcamState("active");
      setStatusMessage(CAMERA_MESSAGES.active);
      startWebcamLoop();

      const refreshedDevices = await navigator.mediaDevices.enumerateDevices();
      const cameras = refreshedDevices.filter((item) => item.kind === "videoinput");
      setDevices(refreshedDevices);
      setDeviceId((current) => current ?? cameras[0]?.deviceId);
    } catch (caughtError) {
      const details = getCameraErrorDetails(caughtError);
      setHasCameraPermission(
        details.message.includes("bloqueado") ? false : hasCameraPermission,
      );
      setWebcamState(details.state);
      setStatusMessage(details.message);
      setError(details.message);
      logCameraError("start", caughtError, {
        deviceId,
        isSecureContext:
          typeof window !== "undefined" ? window.isSecureContext : null,
      });

      if (details.shouldRetry) {
        setStatusMessage(CAMERA_MESSAGES.reconnecting);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectTimeoutRef.current = null;
          if (!isCameraPaused) {
            void startCamera();
          }
        }, 2500);
      }
    }
  }, [
    deviceId,
    hasCameraPermission,
    isCameraPaused,
    sortedDevices.length,
    startWebcamLoop,
    stopCamera,
  ]);

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setWebcamState("unavailable");
      setStatusMessage("Nenhuma camera foi encontrada neste dispositivo.");
      setError("Nenhuma camera foi encontrada neste dispositivo.");
      return;
    }

    const syncDevices = async () => {
      try {
        const available = await navigator.mediaDevices.enumerateDevices();
        const cameras = available.filter((item) => item.kind === "videoinput");
        setDevices(available);
        setDeviceId((current) => current ?? cameras[0]?.deviceId);

        if (!cameras.length) {
          setWebcamState("unavailable");
          setStatusMessage("Nenhuma camera foi encontrada neste dispositivo.");
          setError("Nenhuma camera foi encontrada neste dispositivo.");
          return;
        }

        if (hasCameraPermission !== true) {
          setWebcamState("permission");
          setStatusMessage(CAMERA_MESSAGES.permission);
        }
      } catch (caughtError) {
        setWebcamState("error");
        setStatusMessage("Nao foi possivel iniciar a camera.");
        setError("Nao foi possivel iniciar a camera.");
        logCameraError("enumerateDevices", caughtError);
      }
    };

    void syncDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", syncDevices);

    return () => {
      navigator.mediaDevices.removeEventListener?.("devicechange", syncDevices);
      stopCamera();
      void disposePoseLandmarker();
    };
  }, [hasCameraPermission, stopCamera]);

  useEffect(() => {
    if (!hasCameraPermission || isCameraPaused || !deviceId) return;

    void startCamera();
  }, [deviceId, hasCameraPermission, isCameraPaused, startCamera]);

  useEffect(() => {
    if (!videoRef.current) return;

    if (isCameraPaused) {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      videoRef.current.pause();
      setWebcamState("paused");
      setStatusMessage(CAMERA_MESSAGES.paused);
      return;
    }

    if (streamRef.current) {
      void videoRef.current.play().catch(() => undefined);
      startWebcamLoop();
    }
  }, [isCameraPaused, startWebcamLoop]);

  const handleSaveCurrentAnalysis = useCallback(async () => {
    await persistCurrentAnalysis({ force: true });
  }, [persistCurrentAnalysis]);

  useEffect(() => {
    if (!visibleAnalysis || webcamState !== "active" || isCameraPaused) {
      return;
    }

    if (autoPersistTimeoutRef.current) {
      window.clearTimeout(autoPersistTimeoutRef.current);
    }

    autoPersistTimeoutRef.current = window.setTimeout(() => {
      void persistCurrentAnalysis({ silent: true });
    }, 1800);

    return () => {
      if (autoPersistTimeoutRef.current) {
        window.clearTimeout(autoPersistTimeoutRef.current);
        autoPersistTimeoutRef.current = null;
      }
    };
  }, [isCameraPaused, persistCurrentAnalysis, visibleAnalysis, webcamState]);

  const handleCalibration = useCallback(() => {
    if (!visibleAnalysis) {
      setError("Aguarde uma leitura valida da camera para calibrar.");
      return;
    }

    const metricsMap = Object.fromEntries(
      visibleAnalysis.metrics.map((metric) => [metric.key, metric.value]),
    );

    setCalibration({
      capturedAt: new Date().toISOString(),
      score: visibleAnalysis.score,
      metrics: metricsMap,
      cervicalAngle: visibleAnalysis.cervicalAngle,
      trunkAngle: visibleAnalysis.trunkAngle,
      shoulderAsymmetry: visibleAnalysis.shoulderAsymmetry,
      hipAsymmetry: visibleAnalysis.hipAsymmetry,
      alignment: visibleAnalysis.alignment,
    });
    setError(null);
    setStatusMessage(
      "Calibracao salva. A postura atual passou a ser a referencia da sessao.",
    );
  }, [visibleAnalysis]);

  return (
    <div className="space-y-6">
      {webcamState !== "active" ? (
        <Card className="border-emerald-400/20 bg-emerald-400/10">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                  Permissao da camera
                </p>
                <p className="text-base font-semibold text-white">
                  {webcamState === "permission"
                    ? CAMERA_MESSAGES.permission
                    : statusMessage}
                </p>
                <p className="text-sm text-zinc-200">
                  Autorize a camera para iniciar o esqueleto corporal, as metricas biomecanicas e o salvamento automatico da sua analise no Supabase.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void startCamera()}
                  type="button"
                >
                  <Camera className="h-4 w-4" />
                  Permitir acesso
                </Button>
                {sortedDevices.length > 1 ? (
                  <Button
                    onClick={() => {
                      const currentIndex = sortedDevices.findIndex(
                        (item) => item.deviceId === deviceId,
                      );
                      const nextDevice =
                        sortedDevices[(currentIndex + 1) % sortedDevices.length];
                      setDeviceId(nextDevice?.deviceId);
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Trocar camera
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div
        className={`grid gap-6 ${
          visibleAnalysis ? "xl:grid-cols-[1.15fr_0.85fr]" : ""
        }`}
      >
        <Card className="mesh-bg">
          <CardHeader>
            <CardTitle>Webcam e esqueleto corporal</CardTitle>
            <CardDescription>
              Monitoramento postural em tempo real com MediaPipe Pose, overlay biomecanico, score executivo e recomendacoes continuas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/60">
              <video
                className="aspect-video w-full object-cover"
                playsInline
                ref={videoRef}
              />
              <canvas
                className="pointer-events-none absolute inset-0 h-full w-full"
                ref={overlayCanvasRef}
              />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge variant={webcamState === "active" ? "success" : "warning"}>
                  {webcamState === "active"
                    ? "Online"
                    : webcamState === "connecting"
                      ? "Conectando"
                      : webcamState === "paused"
                        ? "Pausada"
                        : webcamState === "unavailable"
                          ? "Sem camera"
                          : webcamState === "error"
                            ? "Erro"
                            : "Permissao"}
                </Badge>
                {visibleAnalysis ? (
                  <>
                    <Badge variant="neutral">{visibleAnalysis.fps.toFixed(1)} FPS</Badge>
                    <Badge variant="neutral">{visibleAnalysis.resolution}</Badge>
                    <Badge variant="neutral">
                      {visibleAnalysis.landmarkCount} landmarks
                    </Badge>
                    <Badge
                      variant={
                        visibleAnalysis.quality === "Alta"
                          ? "success"
                          : visibleAnalysis.quality === "Moderada"
                            ? "warning"
                            : "danger"
                      }
                    >
                      Qualidade {visibleAnalysis.quality}
                    </Badge>
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Estado
                </p>
                <p className="mt-3 text-sm text-white">{statusMessage}</p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Permissao
                </p>
                <p className="mt-3 text-sm text-white">
                  {hasCameraPermission === true
                    ? "Concedida"
                    : hasCameraPermission === false
                      ? "Bloqueada"
                      : "Pendente"}
                </p>
              </div>
              {visibleAnalysis ? (
                <>
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Centro de massa
                    </p>
                    <p className="mt-3 text-sm text-white">
                      X {Math.round(visibleAnalysis.centerOfMass.x * 100)}% / Y{" "}
                      {Math.round(visibleAnalysis.centerOfMass.y * 100)}%
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Calibracao
                    </p>
                    <p className="mt-3 text-sm text-white">
                      {calibration
                        ? `Referencia ${calibration.score}/100`
                        : "Pronta para registrar a melhor postura da sessao"}
                    </p>
                  </div>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              {sortedDevices.length > 1 ? (
                <select
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white"
                  onChange={(event) => setDeviceId(event.target.value)}
                  value={deviceId}
                >
                  {sortedDevices.map((device, index) => (
                    <option
                      className="bg-zinc-950"
                      key={device.deviceId}
                      value={device.deviceId}
                    >
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              ) : null}

              <Button
                disabled={!visibleAnalysis || isSaving}
                onClick={() => void handleSaveCurrentAnalysis()}
                type="button"
              >
                <ScanLine className="h-4 w-4" />
                {isSaving ? "Salvando relatorio..." : "Salvar relatorio atual"}
              </Button>
              <Button onClick={handleCalibration} type="button" variant="secondary">
                Calibrar postura
              </Button>
              <Button
                onClick={() => {
                  setCalibration(null);
                  setStatusMessage("Calibracao removida.");
                }}
                type="button"
                variant="secondary"
              >
                Limpar calibracao
              </Button>
              <Button
                onClick={() => setIsCameraPaused((current) => !current)}
                type="button"
                variant="secondary"
              >
                {isCameraPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {isCameraPaused ? "Retomar" : "Pausar"}
              </Button>
              {sortedDevices.length > 1 ? (
                <Button
                  onClick={() => {
                    const currentIndex = sortedDevices.findIndex(
                      (item) => item.deviceId === deviceId,
                    );
                    const nextDevice =
                      sortedDevices[(currentIndex + 1) % sortedDevices.length];
                    setDeviceId(nextDevice?.deviceId);
                  }}
                  type="button"
                  variant="secondary"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Trocar camera
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Contexto da analise</Label>
              <Textarea
                id="notes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: muitas reunioes seguidas, home office, tensao cervical no fim do dia."
                value={notes}
              />
            </div>

            {error ? (
              <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {visibleAnalysis ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Score postural</CardTitle>
                <CardDescription>
                  Prioridade executiva da leitura atual da webcam.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                          Score
                        </p>
                        <p className="mt-3 text-5xl font-semibold text-white">
                          {visibleAnalysis.score}
                        </p>
                      </div>
                      {classification ? (
                        <Badge variant={classification.variant}>
                          {classification.label}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-zinc-300">
                      {savedAnalysis?.summary || classification?.description}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Risco postural
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <Badge variant={badgeVariantFromStatus(visibleAnalysis.status)}>
                        {riskLabel(visibleAnalysis.riskLevel)}
                      </Badge>
                      <span className="text-sm text-zinc-400">
                        Confianca {visibleAnalysis.confidence.toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-300">
                      {visibleAnalysis.executiveSummary}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Alinhamento corporal
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {visibleAnalysis.alignment.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Estabilidade corporal
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {visibleAnalysis.stability.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Qualidade da deteccao
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {visibleAnalysis.quality}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status em tempo real</CardTitle>
                <CardDescription>
                  Telemetria do pipeline de deteccao enquanto a webcam esta ativa.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Online", "Sim"],
                  ["FPS", visibleAnalysis.fps.toFixed(1)],
                  ["Resolucao", visibleAnalysis.resolution],
                  ["Landmarks detectados", String(visibleAnalysis.landmarkCount)],
                  ["Confianca", `${visibleAnalysis.confidence.toFixed(0)}%`],
                  ["Qualidade", visibleAnalysis.quality],
                ].map(([label, value]) => (
                  <div
                    className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                    key={label}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-3 text-lg font-medium text-white">{value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {visibleAnalysis ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Metricas biomecanicas</CardTitle>
              <CardDescription>
                Angulos, assimetrias e indicadores biomecanicos atualizados frame a frame.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ["Inclinacao cervical", `${visibleAnalysis.cervicalAngle.toFixed(1)}°`],
                  ["Inclinacao do tronco", `${visibleAnalysis.trunkAngle.toFixed(1)}°`],
                  ["Assimetria dos ombros", `${visibleAnalysis.shoulderAsymmetry.toFixed(1)}°`],
                  ["Assimetria do quadril", `${visibleAnalysis.hipAsymmetry.toFixed(1)}°`],
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

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleAnalysis.metrics.map((metric) => (
                  <div
                    className="rounded-[20px] border border-white/10 bg-black/20 p-4"
                    key={metric.key}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-white">{metric.label}</p>
                      <Badge variant={badgeVariantFromSeverity(metric.severity)}>
                        {metric.severity}
                      </Badge>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-white">
                      {formatMetricValue(metric)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle>Desvios identificados</CardTitle>
                <CardDescription>
                  Principais compensacoes detectadas na leitura atual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {visibleAnalysis.deviations.length ? (
                  visibleAnalysis.deviations.map((item) => (
                    <div
                      className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-black/20 p-4"
                      key={item}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-300" />
                      <p className="text-sm text-zinc-200">{item}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex items-start gap-3 rounded-[20px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                    <p className="text-sm text-emerald-100">
                      Sem desvios relevantes na leitura atual.
                    </p>
                  </div>
                )}

                {savedAnalysis?.diagnosis ? (
                  <>
                    <Separator />
                    <p className="text-sm text-zinc-300">{savedAnalysis.diagnosis}</p>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recomendacoes inteligentes</CardTitle>
                <CardDescription>
                  Ajustes imediatos, exercicios e plano de acao gerados a partir dos desvios atuais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Sparkles className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.2em]">
                        Ajuste imediato
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {visibleRecommendations.slice(0, 3).map((item) => (
                        <p className="text-sm text-zinc-200" key={item}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Activity className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.2em]">
                        Exercicios
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(visibleExercises.length
                        ? visibleExercises
                        : [
                            "Retracao escapular controlada por 3 series de 8 repeticoes.",
                            "Mobilidade cervical leve por 2 minutos.",
                            "Alongamento toracico com respiracao profunda por 90 segundos.",
                          ]).map((item) => (
                        <p className="text-sm text-zinc-200" key={item}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Camera className="h-4 w-4" />
                      <p className="text-xs uppercase tracking-[0.2em]">
                        Habitos corretivos
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {[
                        "Ajuste a altura do monitor para a linha dos olhos.",
                        "Mantenha os dois pes apoiados e o quadril centralizado.",
                        "Interrompa periodos longos sentado com pausas ativas.",
                      ].map((item) => (
                        <p className="text-sm text-zinc-200" key={item}>
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                    Relatorio estruturado
                  </p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-black/30 p-4">
                      <p className="text-sm font-medium text-white">
                        Resumo executivo
                      </p>
                      <p className="mt-3 text-sm text-zinc-300">
                        {savedAnalysis?.summary || visibleAnalysis.executiveSummary}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/30 p-4">
                      <p className="text-sm font-medium text-white">
                        Principais desvios
                      </p>
                      <p className="mt-3 text-sm text-zinc-300">
                        {visibleAnalysis.deviations.join(", ") ||
                          "Sem desvios relevantes nesta leitura."}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/30 p-4">
                      <p className="text-sm font-medium text-white">Metricas</p>
                      <p className="mt-3 text-sm text-zinc-300">
                        Cervical {visibleAnalysis.cervicalAngle.toFixed(1)}°, tronco{" "}
                        {visibleAnalysis.trunkAngle.toFixed(1)}°, alinhamento{" "}
                        {visibleAnalysis.alignment.toFixed(0)}% e estabilidade{" "}
                        {visibleAnalysis.stability.toFixed(0)}%.
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-black/30 p-4">
                      <p className="text-sm font-medium text-white">
                        Plano de acao
                      </p>
                      <div className="mt-3 space-y-2">
                        {visiblePlan.map((step) => (
                          <div key={`${step.time}-${step.title}`}>
                            <p className="text-sm text-white">
                              {step.time} - {step.title}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {step.rationale}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {preview ? (
            <Card>
              <CardHeader>
                <CardTitle>Workspace de analise</CardTitle>
                <CardDescription>
                  Registro salvo da leitura atual, movido para o final da pagina.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <EvidenceOverlay
                  imageSrc={preview}
                  landmarks={savedAnalysis?.landmarks.length ? savedAnalysis.landmarks : visibleAnalysis.landmarks}
                />
                {calibration && visibleAnalysis.calibratedDrift.length ? (
                  <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Comparativo com calibracao
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-zinc-200">
                      {visibleAnalysis.calibratedDrift.map((metric) => (
                        <p key={metric.label}>
                          {metric.label}: {metric.delta > 0 ? "+" : ""}
                          {metric.delta}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {savedAnalysis?.analyzedAt ? (
                  <p className="text-xs text-zinc-500">
                    Ultimo relatorio salvo em {savedAnalysis.analyzedAt}.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <canvas className="hidden" ref={captureCanvasRef} />
    </div>
  );
}
