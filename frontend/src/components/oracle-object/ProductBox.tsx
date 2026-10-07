"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useMaterials } from "./materials";

/** The product: an ivory shoebox with its ink lid lifted. No gold — gold belongs to decisions. */
export function ProductBox({ float = true }: { float?: boolean }) {
  const M = useMaterials();
  const lid = useRef<Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const g = useMemo(
    () => ({
      base: new RoundedBoxGeometry(3.4, 1.2, 2.1, 5, 0.04),
      tissue: new RoundedBoxGeometry(3.2, 0.06, 1.9, 3, 0.02),
      lid: new RoundedBoxGeometry(3.5, 0.34, 2.2, 5, 0.04),
      stripe: new RoundedBoxGeometry(0.2, 0.346, 2.214, 3, 0.02),
    }),
    [],
  );
  useEffect(() => () => Object.values(g).forEach((x) => x.dispose()), [g]);
  useEffect(() => invalidate(), [invalidate]);
  useFrame((state) => {
    if (!lid.current) return;
    const t = state.clock.elapsedTime;
    lid.current.position.y = 2.35 + (float ? Math.sin(t * 0.7) * 0.06 : 0);
    lid.current.rotation.z = 0.14 + (float ? Math.sin(t * 0.5) * 0.015 : 0);
    if (float) state.invalidate();
  });
  return (
    <group rotation-y={-0.45}>
      <mesh geometry={g.base} material={M.ivory} position-y={0.6} castShadow receiveShadow />
      <mesh geometry={g.tissue} material={M.bone} position-y={1.19} castShadow receiveShadow />
      <group ref={lid} position={[0.1, 2.35, -0.1]} rotation={[0.05, 0, 0.14]}>
        <mesh geometry={g.lid} material={M.black} castShadow receiveShadow />
        <mesh geometry={g.stripe} material={M.ivory} position-x={1.2} castShadow />
      </group>
    </group>
  );
}
