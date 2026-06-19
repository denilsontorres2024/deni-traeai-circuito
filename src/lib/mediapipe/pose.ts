"use client";

import type { PoseLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseInputSource = "image" | "video";

export interface NamedLandmark {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

const LANDMARK_NAMES = [
  "nose",
  "left_eye_inner",
  "left_eye",
  "left_eye_outer",
  "right_eye_inner",
  "right_eye",
  "right_eye_outer",
  "left_ear",
  "right_ear",
  "mouth_left",
  "mouth_right",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_pinky",
  "right_pinky",
  "left_index",
  "right_index",
  "left_thumb",
  "right_thumb",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
  "left_heel",
  "right_heel",
  "left_foot_index",
  "right_foot_index",
] as const;

type MediaPipeModule = typeof import("@mediapipe/tasks-vision");

let mediapipeModulePromise: Promise<MediaPipeModule> | null = null;
let imageLandmarkerPromise: Promise<PoseLandmarker> | null = null;
let videoLandmarkerPromise: Promise<PoseLandmarker> | null = null;

function debugLog(hypothesisId: string, location: string, msg: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[PostureAI][${location}] ${msg}`, data);
  }
}

function getFriendlyFrameError() {
  return "Nao foi possivel analisar este frame. Ajuste a camera ou tente novamente.";
}

async function getMediaPipeModule() {
  if (!mediapipeModulePromise) {
    mediapipeModulePromise = import("@mediapipe/tasks-vision");
  }

  return mediapipeModulePromise;
}

async function createLandmarker(runningMode: "IMAGE" | "VIDEO") {
  const { FilesetResolver, PoseLandmarker } = await getMediaPipeModule();
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
  );

  debugLog("B", "mediapipe/pose.ts:createLandmarker", "creating pose landmarker", {
    runningMode,
  });

  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    },
    runningMode,
    numPoses: 1,
  });
}

export async function initializePoseLandmarker(mode: "IMAGE" | "VIDEO") {
  if (typeof window === "undefined") {
    throw new Error("MediaPipe deve ser executado apenas no client.");
  }

  if (mode === "IMAGE") {
    imageLandmarkerPromise ??= createLandmarker("IMAGE");
    return imageLandmarkerPromise;
  }

  videoLandmarkerPromise ??= createLandmarker("VIDEO");
  return videoLandmarkerPromise;
}

export function validateVideoFrame(video: HTMLVideoElement) {
  return Boolean(
    video &&
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0,
  );
}

export function validateCanvasFrame(canvas: HTMLCanvasElement) {
  return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
}

export function validateImageFrame(image: HTMLImageElement) {
  return Boolean(
    image &&
      image.complete === true &&
      image.naturalWidth > 0 &&
      image.naturalHeight > 0,
  );
}

export async function waitForVideoReady(video: HTMLVideoElement) {
  if (validateVideoFrame(video)) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(getFriendlyFrameError()));
    }, 8000);

    const onReady = () => {
      if (validateVideoFrame(video)) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("loadeddata", onReady);
    };

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("loadeddata", onReady);
  });
}

export async function waitForImageReady(image: HTMLImageElement) {
  if (validateImageFrame(image)) return;

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(getFriendlyFrameError()));
    }, 8000);

    const onReady = () => {
      if (validateImageFrame(image)) {
        cleanup();
        resolve();
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error(getFriendlyFrameError()));
    };

    const cleanup = () => {
      window.clearTimeout(timeout);
      image.removeEventListener("load", onReady);
      image.removeEventListener("error", onError);
    };

    image.addEventListener("load", onReady);
    image.addEventListener("error", onError);
  });
}

function normalizeLandmarks(landmarks: NormalizedLandmark[]): NamedLandmark[] {
  return landmarks.map((landmark, index) => ({
    name: LANDMARK_NAMES[index] ?? `landmark_${index}`,
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility,
  }));
}

function extractPoseOrThrow(landmarks?: NormalizedLandmark[]) {
  if (!landmarks?.length) {
    throw new Error(getFriendlyFrameError());
  }

  return normalizeLandmarks(landmarks);
}

export async function analyzeImage(
  source: HTMLImageElement | HTMLCanvasElement,
) {
  if (source instanceof HTMLImageElement) {
    await waitForImageReady(source);
  } else if (!validateCanvasFrame(source)) {
    throw new Error(getFriendlyFrameError());
  }

  const landmarker = await initializePoseLandmarker("IMAGE");

  try {
    debugLog("B", "mediapipe/pose.ts:analyzeImage", "detect image", {
      tagName: source.tagName,
      width: "width" in source ? source.width : undefined,
      height: "height" in source ? source.height : undefined,
    });

    const result = landmarker.detect(source);
    return extractPoseOrThrow(result.landmarks[0]);
  } catch (error) {
    debugLog("A", "mediapipe/pose.ts:analyzeImage:error", "image detect failed", {
      error: String(error),
    });
    throw new Error(getFriendlyFrameError());
  }
}

export async function analyzeVideoFrame(
  source: HTMLVideoElement | HTMLCanvasElement,
  timestampMs = performance.now(),
) {
  if (source instanceof HTMLVideoElement) {
    await waitForVideoReady(source);
  } else if (!validateCanvasFrame(source)) {
    throw new Error(getFriendlyFrameError());
  }

  const landmarker = await initializePoseLandmarker("VIDEO");

  try {
    debugLog("A", "mediapipe/pose.ts:analyzeVideoFrame", "detect video frame", {
      tagName: source.tagName,
      width: "width" in source ? source.width : undefined,
      height: "height" in source ? source.height : undefined,
      videoWidth: "videoWidth" in source ? source.videoWidth : undefined,
      videoHeight: "videoHeight" in source ? source.videoHeight : undefined,
      timestampMs,
    });

    const result = landmarker.detectForVideo(source, timestampMs);
    return extractPoseOrThrow(result.landmarks[0]);
  } catch (error) {
    debugLog("A", "mediapipe/pose.ts:analyzeVideoFrame:error", "video detect failed", {
      error: String(error),
    });
    throw new Error(getFriendlyFrameError());
  }
}

export async function disposePoseLandmarker() {
  const imageLandmarker = imageLandmarkerPromise ? await imageLandmarkerPromise : null;
  const videoLandmarker = videoLandmarkerPromise ? await videoLandmarkerPromise : null;

  imageLandmarker?.close();
  videoLandmarker?.close();

  imageLandmarkerPromise = null;
  videoLandmarkerPromise = null;
}
