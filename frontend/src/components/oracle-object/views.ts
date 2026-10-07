import type { CircuitState } from "@/types";
import type { ObjectPose } from "./OracleObject";
import type { AnchorRoot } from "./Anchors";

export type Variant = "hero" | "rest" | "forecast" | "stress" | "circuit" | "authority" | "product";

export interface CameraView {
  target: [number, number, number];
  dir: [number, number, number];
  distance: number;
  fov: number;
  /** Narrowest width/height the framing was composed for; narrower canvases pull the camera back. */
  fitAspect?: number;
}

/** Camera framing for each state of the object. */
export const VIEWS: Record<Variant, CameraView> = {
  hero: { target: [0.62, 1.55, 0], dir: [0.5, 0.36, 1], distance: 14.6, fov: 20 },
  rest: { target: [0.1, 1.15, 0], dir: [0.62, 0.36, 0.78], distance: 10.4, fov: 22 },
  forecast: { target: [0.1, 1.35, 0], dir: [0.62, 0.38, 0.78], distance: 10.6, fov: 22 },
  stress: { target: [0.45, 1.6, -0.2], dir: [0.62, 0.34, 0.8], distance: 12.2, fov: 22, fitAspect: 1.0 },
  circuit: { target: [0, 0.3, 0.45], dir: [0, 1.0, 1], distance: 15.2, fov: 22, fitAspect: 1.3 },
  authority: { target: [0, 1.2, 0], dir: [0.62, 0.36, 0.8], distance: 10.8, fov: 22, fitAspect: 0.9 },
  product: { target: [0.3, 1.35, 0], dir: [0.72, 0.5, 1], distance: 13.5, fov: 22 },
};

export interface SceneProps {
  variant: Variant;
  pose?: ObjectPose;
  authorityLevel?: number;
  authorityFocus?: number | null;
  circuitState?: CircuitState;
  anchorRootRef?: AnchorRoot;
  float?: boolean;
  frameloop: "always" | "never";
  onReady?: () => void;
  view?: Partial<CameraView>;
}

export function cameraPosition(v: CameraView): [number, number, number] {
  const [x, y, z] = v.dir;
  const n = Math.hypot(x, y, z);
  return [v.target[0] + (x / n) * v.distance, v.target[1] + (y / n) * v.distance, v.target[2] + (z / n) * v.distance];
}
