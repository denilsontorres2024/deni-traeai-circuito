import { z } from "zod";

export const postureMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.enum(["degrees", "ratio", "score"]),
  severity: z.enum(["low", "medium", "high"]),
});

export const postureAnalyzeSchema = z.object({
  mode: z.enum(["webcam", "image", "video"]),
  imageBase64: z.string().optional(),
  fileUrl: z.string().url().optional(),
  landmarks: z.array(
    z.object({
      name: z.string(),
      x: z.number(),
      y: z.number(),
      z: z.number().optional(),
      visibility: z.number().optional(),
    }),
  ),
  metrics: z.array(postureMetricSchema),
  notes: z.string().max(1000).optional(),
});

export type PostureAnalyzeInput = z.infer<typeof postureAnalyzeSchema>;
export type PostureMetric = z.infer<typeof postureMetricSchema>;
