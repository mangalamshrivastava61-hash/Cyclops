"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color, Mesh, MeshPhysicalMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Line2, LineSegments2 } from "three-stdlib";
import { MAT } from "@/lib/tokens";
import { OBJ, damp } from "./dims";
import { WireBox } from "./WireBox";
import { fadeMaterial, tintMaterial } from "./frame";

const S = 2;
const H = 0.44;
const GAP = 0.05;
const LEVELS = [0, 1, 2, 3, 4] as const;

const ivory = new Color(MAT.ivory);
const black = new Color(MAT.black);
const gold = new Color(MAT.gold);

/**
 * Authority as the object's height: how much ORACLE may do alone.
 * Earned levels are built (the current one in gold); unearned levels are only drawn.
 */
export function AuthorityStack({ level, focus = null }: { level: number; focus?: number | null }) {
  const geo = useMemo(() => new RoundedBoxGeometry(S, H, S, 5, S * 0.028), []);
  const mats = useMemo(
    () =>
      LEVELS.map(
        (i) =>
          new MeshPhysicalMaterial({
            color: i === 0 ? MAT.black : MAT.ivory,
            roughness: 0.55,
            clearcoat: 0.18,
            clearcoatRoughness: 0.45,
            transparent: true,
          }),
      ),
    [],
  );
  useEffect(() => () => {
    geo.dispose();
    mats.forEach((m) => m.dispose());
  }, [geo, mats]);

  const solids = useRef<(Mesh | null)[]>([]);
  const wires = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const built = useRef<number[]>(LEVELS.map((i) => (i <= level ? 1 : 0)));
  const lifted = useRef<number[]>(LEVELS.map(() => 0));
  const tint = useRef<number[]>(LEVELS.map((i) => (i === level ? 1 : 0)));

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, level, focus]);

  useFrame((state, dt) => {
    let moving = false;
    for (const i of LEVELS) {
      built.current[i] = damp(built.current[i], i <= level ? 1 : 0, 3.2, dt);
      lifted.current[i] = damp(lifted.current[i], focus === i ? 0.07 : 0, 6, dt);
      tint.current[i] = damp(tint.current[i], i === level ? 1 : 0, 3.2, dt);
      const b = built.current[i];
      const mesh = solids.current[i];
      const y0 = i * (H + GAP) + lifted.current[i];
      if (mesh) {
        mesh.visible = b > 0.01;
        mesh.scale.y = Math.max(0.001, b);
        mesh.position.y = y0 + (H * b) / 2;
        tintMaterial(mats[i], i === 0 ? black : ivory, gold, tint.current[i], Math.min(1, b * 1.6));
      }
      const w = wires.current[i];
      fadeMaterial(w?.material, Math.max(0, 1 - b * 1.4));
      if (w?.parent) w.parent.position.y = y0 + H / 2;
      moving ||= Math.abs(b - (i <= level ? 1 : 0)) > 1e-3 || Math.abs(tint.current[i] - (i === level ? 1 : 0)) > 1e-3 || Math.abs(lifted.current[i] - (focus === i ? 0.07 : 0)) > 1e-3;
    }
    if (moving) state.invalidate();
  });

  return (
    <group rotation-y={OBJ.rest}>
      {LEVELS.map((i) => (
        <group key={i} rotation-y={i * 0.06}>
          <mesh
            ref={(el) => {
              solids.current[i] = el;
            }}
            geometry={geo}
            material={mats[i]}
            castShadow
            receiveShadow
          />
          <WireBox
            ref={(el) => {
              wires.current[i] = el;
            }}
            size={[S, H, S]}
            position={[0, i * (H + GAP) + H / 2, 0]}
            width={1.25}
            opacity={i <= level ? 0 : 1}
          />
        </group>
      ))}
    </group>
  );
}
