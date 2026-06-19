import { clamp } from "@/lib/utils";

export interface NamedLandmark {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ComputedPostureMetric {
  key: string;
  label: string;
  value: number;
  unit: "degrees" | "ratio" | "score";
  severity: "low" | "medium" | "high";
}

export interface PostureRecommendation {
  title: string;
  description: string;
}

function getAngle(a: NamedLandmark, b: NamedLandmark) {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

function abs(value: number) {
  return Math.abs(Number(value.toFixed(2)));
}

function severityFromThresholds(value: number, medium: number, high: number) {
  if (value >= high) return "high";
  if (value >= medium) return "medium";
  return "low";
}

function requireLandmark(map: Map<string, NamedLandmark>, name: string) {
  const landmark = map.get(name);
  if (!landmark) {
    throw new Error(`Landmark ausente: ${name}`);
  }

  return landmark;
}

export function computePostureMetrics(landmarks: NamedLandmark[]): ComputedPostureMetric[] {
  const map = new Map(landmarks.map((landmark) => [landmark.name, landmark]));

  const leftShoulder = requireLandmark(map, "left_shoulder");
  const rightShoulder = requireLandmark(map, "right_shoulder");
  const leftHip = requireLandmark(map, "left_hip");
  const rightHip = requireLandmark(map, "right_hip");
  const leftEar = requireLandmark(map, "left_ear");
  const rightEar = requireLandmark(map, "right_ear");
  const nose = requireLandmark(map, "nose");

  const shoulderAlignment = abs(leftShoulder.y - rightShoulder.y) * 100;
  const hipAlignment = abs(leftHip.y - rightHip.y) * 100;
  const cervicalTilt = abs(getAngle(leftShoulder, leftEar) - getAngle(rightShoulder, rightEar));
  const lateralTilt = abs(((leftShoulder.y + rightShoulder.y) / 2 - (leftHip.y + rightHip.y) / 2) * 100);
  const symmetry = abs(
    ((leftShoulder.x - leftHip.x) - (rightHip.x - rightShoulder.x)) * 100,
  );
  const headForward = abs(
    nose.x - (leftShoulder.x + rightShoulder.x) / 2,
  ) * 100;

  return [
    {
      key: "shoulder_alignment",
      label: "Alinhamento dos ombros",
      value: clamp(shoulderAlignment, 0, 100),
      unit: "score",
      severity: severityFromThresholds(shoulderAlignment, 4, 8),
    },
    {
      key: "hip_alignment",
      label: "Alinhamento do quadril",
      value: clamp(hipAlignment, 0, 100),
      unit: "score",
      severity: severityFromThresholds(hipAlignment, 3, 7),
    },
    {
      key: "cervical_tilt",
      label: "Inclinacao cervical",
      value: clamp(cervicalTilt, 0, 180),
      unit: "degrees",
      severity: severityFromThresholds(cervicalTilt, 8, 16),
    },
    {
      key: "lateral_tilt",
      label: "Inclinacao lateral",
      value: clamp(lateralTilt, 0, 100),
      unit: "score",
      severity: severityFromThresholds(lateralTilt, 5, 10),
    },
    {
      key: "body_symmetry",
      label: "Simetria corporal",
      value: clamp(symmetry, 0, 100),
      unit: "score",
      severity: severityFromThresholds(symmetry, 5, 10),
    },
    {
      key: "forward_head_projection",
      label: "Projecao anterior da cabeca",
      value: clamp(headForward, 0, 100),
      unit: "score",
      severity: severityFromThresholds(headForward, 6, 12),
    },
  ];
}

export function scoreFromMetrics(metrics: ComputedPostureMetric[]) {
  const penalty = metrics.reduce((total, metric) => {
    if (metric.severity === "high") return total + 18;
    if (metric.severity === "medium") return total + 10;
    return total + 3;
  }, 0);

  return clamp(100 - penalty, 0, 100);
}

export function riskLevelFromScore(score: number): "low" | "medium" | "high" {
  if (score < 50) return "high";
  if (score < 70) return "medium";
  return "low";
}

export function detectIssues(metrics: ComputedPostureMetric[]) {
  return metrics
    .filter((metric) => metric.severity !== "low")
    .map((metric) => {
      switch (metric.key) {
        case "forward_head_projection":
          return "Cabeca projetada para frente";
        case "shoulder_alignment":
          return "Ombros assimetricos ou elevados";
        case "hip_alignment":
          return "Inclinacao pelvica";
        case "lateral_tilt":
          return "Inclinacao lateral";
        case "body_symmetry":
          return "Assimetria corporal";
        case "cervical_tilt":
          return "Tensao cervical";
        default:
          return metric.label;
      }
    });
}

export function recommendationsFromMetrics(metrics: ComputedPostureMetric[]) {
  const recommendations: PostureRecommendation[] = [];

  for (const metric of metrics) {
    if (metric.severity === "low") {
      continue;
    }

    switch (metric.key) {
      case "forward_head_projection":
        recommendations.push({
          title: "Reposicione a cabeca",
          description:
            "Aproxime o monitor da linha dos olhos e recue levemente o queixo para reduzir a projecao anterior.",
        });
        break;
      case "shoulder_alignment":
        recommendations.push({
          title: "Relaxe a cintura escapular",
          description:
            "Ajuste apoio dos bracos, descruze os ombros e faça uma pausa curta para soltar trapezio e peitoral.",
        });
        break;
      case "hip_alignment":
        recommendations.push({
          title: "Reequilibre a base sentada",
          description:
            "Centralize o quadril na cadeira e mantenha os dois pes apoiados para diminuir inclinacao pelvica.",
        });
        break;
      case "lateral_tilt":
        recommendations.push({
          title: "Corrija a inclinacao lateral",
          description:
            "Redistribua o peso do tronco e alinhe o monitor ao centro para evitar compensacao lateral constante.",
        });
        break;
      case "body_symmetry":
        recommendations.push({
          title: "Reorganize o setup",
          description:
            "Centralize teclado, mouse e tela para evitar rotacao do tronco e assimetria corporal sustentada.",
        });
        break;
      case "cervical_tilt":
        recommendations.push({
          title: "Descomprima a cervical",
          description:
            "Mantenha a nuca longa, relaxe o maxilar e faça micro pausas de mobilidade cervical ao longo do expediente.",
        });
        break;
      default:
        break;
    }
  }

  return recommendations.slice(0, 4);
}
