"use client";

import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";

/** The DOM element whose `[data-anchor]` descendants are pinned to scene points. */
export type AnchorRoot = RefObject<HTMLElement | null>;
export type AnchorPoints = Record<string, () => [number, number, number]>;

/** Imperative style write, kept outside components: labels follow the camera every frame. */
function place(el: HTMLElement, x: number, y: number) {
  el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  el.style.opacity = "1";
}

/**
 * Pins ordinary DOM elements (labels, buttons) to points in the 3D scene.
 * Keeps text in the page's own DOM — selectable, accessible — while it tracks the object.
 * Elements opt in with `data-anchor="<point id>"` inside the root element.
 */
export function Anchors({ rootRef, points }: { rootRef: AnchorRoot; points: AnchorPoints }) {
  useFrame(({ camera, size }) => {
    const root = rootRef.current;
    if (!root) return;
    camera.updateMatrixWorld();
    root.querySelectorAll<HTMLElement>("[data-anchor]").forEach((el) => {
      const get = points[el.dataset.anchor ?? ""];
      if (!get) return;
      const p = new Vector3(...get()).project(camera);
      place(el, ((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height);
    });
  });
  return null;
}
