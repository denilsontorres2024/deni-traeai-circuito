import { describe, expect, it } from "vitest";

import {
  computePostureMetrics,
  detectIssues,
  riskLevelFromScore,
  scoreFromMetrics,
} from "@/lib/posture/posture-metrics";

const landmarks = [
  { name: "left_shoulder", x: 0.35, y: 0.42 },
  { name: "right_shoulder", x: 0.65, y: 0.46 },
  { name: "left_hip", x: 0.4, y: 0.7 },
  { name: "right_hip", x: 0.64, y: 0.73 },
  { name: "left_ear", x: 0.33, y: 0.25 },
  { name: "right_ear", x: 0.63, y: 0.27 },
  { name: "nose", x: 0.56, y: 0.22 },
];

describe("posture-metrics", () => {
  it("calcula metricas biomecanicas basicas", () => {
    const metrics = computePostureMetrics(landmarks);
    expect(metrics).toHaveLength(6);
    expect(metrics[0].key).toBe("shoulder_alignment");
  });

  it("gera score e risco coerentes", () => {
    const metrics = computePostureMetrics(landmarks);
    const score = scoreFromMetrics(metrics);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(riskLevelFromScore(score));
  });

  it("detecta desvios quando ha severidade relevante", () => {
    const issues = detectIssues(
      computePostureMetrics(landmarks).map((metric) =>
        metric.key === "forward_head_projection"
          ? { ...metric, severity: "high" as const }
          : metric,
      ),
    );

    expect(issues).toContain("Cabeca projetada para frente");
  });
});
