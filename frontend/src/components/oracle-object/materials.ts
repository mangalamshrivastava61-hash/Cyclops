"use client";

import { useEffect, useMemo } from "react";
import { MeshPhysicalMaterial, MeshStandardMaterial } from "three";
import { MAT, T } from "@/lib/tokens";

/** The object's three materials: ivory ceramic, black ceramic and gold. Created once per canvas. */
export function useMaterials() {
  const m = useMemo(
    () => ({
      ivory: new MeshPhysicalMaterial({ color: MAT.ivory, roughness: 0.55, clearcoat: 0.18, clearcoatRoughness: 0.45 }),
      bone: new MeshPhysicalMaterial({ color: MAT.bone, roughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.5 }),
      black: new MeshPhysicalMaterial({ color: MAT.black, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      gold: new MeshPhysicalMaterial({ color: MAT.gold, metalness: 0.7, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      ink: new MeshStandardMaterial({ color: MAT.line, roughness: 0.6 }),
      oxblood: new MeshPhysicalMaterial({ color: T.oxblood, roughness: 0.45, clearcoat: 0.4 }),
    }),
    [],
  );
  useEffect(() => () => Object.values(m).forEach((x) => x.dispose()), [m]);
  return m;
}

export type Materials = ReturnType<typeof useMaterials>;
