"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, Group, InstancedMesh, Object3D } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { CircuitState } from "@/types";
import { useMaterials } from "./materials";
import { OracleObject } from "./OracleObject";
import { damp } from "./dims";
import { Anchors, type AnchorRoot } from "./Anchors";

const R = 2.5;
/** Detent angles on the front of the scale (degrees, x = cos, z = sin: +z faces the viewer). */
export const DETENTS: Record<CircuitState, number> = { clear: 150, review: 90, bench: 30 };
const rad = (d: number) => (d * Math.PI) / 180;

export interface DialLabel {
  state: CircuitState;
  title: string;
  sub: string;
}

/**
 * The decision circuit as a machined instrument. The ORACLE object is the selector knob;
 * a fine needle points at Clear, Review or Bench and turns with a damped, mechanical motion.
 */
export function CircuitDial({ state, anchorRootRef }: { state: CircuitState; anchorRootRef?: AnchorRoot }) {
  const M = useMaterials();
  const selector = useRef<Group>(null);
  const angle = useRef(rad(DETENTS[state]));

  const tickGeo = useMemo(() => new BoxGeometry(1, 0.014, 1), []);
  const minor = useRef<InstancedMesh>(null);
  const ticks = useMemo(() => {
    const out: { a: number; len: number; w: number }[] = [];
    for (let a = 10; a <= 170.01; a += 2.5) out.push({ a, len: Math.round(a * 2) % 10 === 0 ? 0.16 : 0.09, w: 0.014 });
    return out;
  }, []);

  useLayoutEffect(() => {
    const d = new Object3D();
    ticks.forEach((t, i) => {
      const r0 = R - 0.3;
      d.position.set(Math.cos(rad(t.a)) * (r0 + t.len / 2), 0.368, Math.sin(rad(t.a)) * (r0 + t.len / 2));
      d.rotation.set(0, -rad(t.a), 0);
      d.scale.set(t.len, 1, t.w);
      d.updateMatrix();
      minor.current?.setMatrixAt(i, d.matrix);
    });
    if (minor.current) minor.current.instanceMatrix.needsUpdate = true;
  }, [ticks]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, state]);

  useFrame((st, dt) => {
    angle.current = damp(angle.current, rad(DETENTS[state]), 3.6, dt);
    if (selector.current) selector.current.rotation.y = -angle.current;
    if (Math.abs(angle.current - rad(DETENTS[state])) > 1e-4) st.invalidate();
  });

  const needleGeo = useMemo(() => new RoundedBoxGeometry(1.25, 0.04, 0.06, 2, 0.015), []);

  return (
    <group>
      {/* machined bezel */}
      <mesh position-y={0.18} material={M.ivory} castShadow receiveShadow>
        <cylinderGeometry args={[R, R + 0.04, 0.36, 200]} />
      </mesh>
      <mesh position-y={0.36} rotation-x={Math.PI / 2} material={M.ivory}>
        <torusGeometry args={[R - 0.01, 0.028, 16, 200]} />
      </mesh>
      <mesh position-y={0.366} material={M.bone} receiveShadow>
        <cylinderGeometry args={[R - 0.34, R - 0.34, 0.012, 200]} />
      </mesh>
      {[R - 0.33, R - 0.08].map((rr) => (
        <mesh key={rr} position-y={0.368} rotation-x={Math.PI / 2} material={M.ink}>
          <torusGeometry args={[rr, 0.006, 8, 240]} />
        </mesh>
      ))}
      <instancedMesh ref={minor} args={[tickGeo, M.ink, ticks.length]} />
      {(Object.keys(DETENTS) as CircuitState[]).map((k) => {
        const a = rad(DETENTS[k]);
        const mat = k === "bench" ? M.oxblood : M.ink;
        return (
          <group key={k}>
            <mesh position={[Math.cos(a) * (R - 0.34 + 0.15), 0.368, Math.sin(a) * (R - 0.34 + 0.15)]} rotation-y={-a} material={mat}>
              <boxGeometry args={[0.3, 0.016, 0.035]} />
            </mesh>
            <mesh position={[Math.cos(a) * (R - 0.52), 0.39, Math.sin(a) * (R - 0.52)]} material={mat} castShadow>
              <cylinderGeometry args={[0.06, 0.06, 0.05, 32]} />
            </mesh>
          </group>
        );
      })}

      {/* selector: the ORACLE object and its needle */}
      <group ref={selector}>
        <OracleObject pose={{}} size={1.4} height={1.2} rest={0} position={[0, 0.37, 0]} materials={M} />
        <mesh geometry={needleGeo} material={M.ink} position={[0.7 + 0.625 - 0.08, 0.42, 0]} castShadow />
      </group>

      {anchorRootRef && (
        <Anchors
          rootRef={anchorRootRef}
          points={Object.fromEntries(
            (Object.keys(DETENTS) as CircuitState[]).map((k) => {
              const a = rad(DETENTS[k]);
              const r = R + 0.62;
              return [k, () => [Math.cos(a) * r, 0.2, Math.sin(a) * r] as [number, number, number]];
            }),
          )}
        />
      )}
    </group>
  );
}
