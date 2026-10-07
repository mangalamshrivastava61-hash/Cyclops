import type { Color, MeshPhysicalMaterial } from "three";

/**
 * Per-frame writes to three.js objects. React Three Fiber animates by mutating scene objects inside
 * the frame loop; keeping those writes in plain functions keeps the components themselves pure.
 */
export function tintMaterial(m: MeshPhysicalMaterial, base: Color, target: Color, t: number, opacity: number) {
  m.color.copy(base).lerp(target, t);
  m.metalness = 0.7 * t;
  m.roughness = 0.55 - 0.25 * t;
  m.clearcoat = 0.18 + 0.42 * t;
  m.opacity = opacity;
}

/** Fade a line material; hidden once fully transparent so it never costs a draw call. */
export function fadeMaterial(material: unknown, opacity: number) {
  const m = material as { opacity: number; visible: boolean } | undefined;
  if (!m) return;
  m.opacity = opacity;
  m.visible = opacity > 0.01;
}
