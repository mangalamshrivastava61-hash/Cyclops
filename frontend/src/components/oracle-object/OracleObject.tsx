"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, Vector3 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Line2, LineSegments2 } from "three-stdlib";
import { fadeMaterial } from "./frame";
import { useMaterials, type Materials } from "./materials";
import { OBJ, SHEAR_DIR, damp, layerHeights } from "./dims";
import { WireBox } from "./WireBox";

export interface ObjectPose {
  /** Forecast: the layers float apart to show an open range (0 = closed) */
  explode?: number;
  /** Stress: how far the layers shear out of line (0 = calm) */
  shear?: number;
  /** Stress: how far the gold decision line rises (world units; 0.34 ≈ 127 → 165) */
  lift?: number;
  /** Hero: the top slab lifts to reveal the eye ring */
  liftTop?: number;
  liftTwist?: number;
}

interface Props {
  pose: ObjectPose;
  ring?: boolean;
  /** Draw the calm plan in ink while the object is sheared */
  outline?: boolean;
  float?: boolean;
  size?: number;
  height?: number;
  rest?: number;
  position?: [number, number, number];
  castShadow?: boolean;
  materials?: Materials;
}

const dir = new Vector3(...SHEAR_DIR);

/**
 * The ORACLE object. Black base = P10, the low case. Gold plate = the decision line.
 * Two ivory slabs = P50 and P90. Every state is a pose of the same object, damped so motion explains the change.
 */
export function OracleObject({ pose, ring = false, outline = false, float = false, size = OBJ.size, height = OBJ.height, rest = OBJ.rest, position = [0, 0, 0], castShadow = true, materials }: Props) {
  const own = useMaterials();
  const M = materials ?? own;
  const L = layerHeights(size, height);
  const geo = useMemo(
    () => ({
      slab: new RoundedBoxGeometry(size, L.h, size, 5, L.radius),
      plate: new RoundedBoxGeometry(size * 0.996, OBJ.plate, size * 0.996, 3, 0.012),
    }),
    [size, L.h, L.radius],
  );

  const group = useRef<Group>(null);
  const base = useRef<Mesh>(null);
  const plate = useRef<Mesh>(null);
  const s1 = useRef<Mesh>(null);
  const s2 = useRef<Mesh>(null);
  const wires = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const cur = useRef({ explode: pose.explode ?? 0, shear: pose.shear ?? 0, lift: pose.lift ?? 0, liftTop: pose.liftTop ?? 0, liftTwist: pose.liftTwist ?? 0 });
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [invalidate, pose.explode, pose.shear, pose.lift, pose.liftTop, pose.liftTwist]);

  useFrame((state, dt) => {
    const c = cur.current;
    const k = 4.2;
    c.explode = damp(c.explode, pose.explode ?? 0, k, dt);
    c.shear = damp(c.shear, pose.shear ?? 0, k, dt);
    c.lift = damp(c.lift, pose.lift ?? 0, k, dt);
    c.liftTop = damp(c.liftTop, pose.liftTop ?? 0, k, dt);
    c.liftTwist = damp(c.liftTwist, pose.liftTwist ?? 0, k, dt);
    const s = c.shear;
    const [t0, t1, t2] = OBJ.twist;

    if (base.current) {
      base.current.position.set(0, L.yBase, 0);
      base.current.rotation.y = rest + t0;
    }
    if (plate.current) {
      plate.current.position.set(dir.x * 0.22 * s, L.yPlate + c.explode * 0.5 + c.lift, dir.z * 0.22 * s);
      plate.current.rotation.y = rest + (t0 + t1) / 2 + 0.12 * s;
    }
    if (s1.current) {
      s1.current.position.set(dir.x * 0.62 * s, L.ySlab1 + c.explode + c.lift + 0.04 * s, dir.z * 0.62 * s);
      s1.current.rotation.y = rest + t1 + 0.3 * s;
    }
    if (s2.current) {
      s2.current.position.set(dir.x * 1.05 * s, L.ySlab2 + 2 * c.explode + c.lift + 0.1 * s + c.liftTop, dir.z * 1.05 * s);
      s2.current.rotation.y = rest + t2 + 0.52 * s + c.liftTwist;
    }
    const o = Math.min(1, s * 4);
    for (const w of wires.current) fadeMaterial(w?.material, o);
    const moving =
      Math.abs(c.explode - (pose.explode ?? 0)) > 1e-3 ||
      Math.abs(c.shear - (pose.shear ?? 0)) > 1e-3 ||
      Math.abs(c.lift - (pose.lift ?? 0)) > 1e-3 ||
      Math.abs(c.liftTop - (pose.liftTop ?? 0)) > 1e-3 ||
      Math.abs(c.liftTwist - (pose.liftTwist ?? 0)) > 1e-3;
    if (moving || float) state.invalidate();
    if (group.current && float) {
      const t = state.clock.elapsedTime;
      group.current.position.y = position[1] + Math.sin(t * 0.8) * 0.05;
      group.current.rotation.y = Math.sin(t * 0.25) * 0.06;
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh ref={base} geometry={geo.slab} material={M.black} castShadow={castShadow} receiveShadow />
      <mesh ref={plate} geometry={geo.plate} material={M.gold} castShadow={castShadow} receiveShadow />
      <mesh ref={s1} geometry={geo.slab} material={M.ivory} castShadow={castShadow} receiveShadow>
        {ring && (
          <group position-y={L.h / 2 + 0.003}>
            <mesh rotation-x={Math.PI / 2} material={M.gold}>
              <torusGeometry args={[size * 0.26, size * 0.012, 16, 128]} />
            </mesh>
            <mesh material={M.gold} position-y={0.002}>
              <cylinderGeometry args={[size * 0.035, size * 0.035, 0.012, 48]} />
            </mesh>
          </group>
        )}
      </mesh>
      <mesh ref={s2} geometry={geo.slab} material={M.ivory} castShadow={castShadow} receiveShadow />
      {outline && (
        <>
          <WireBox ref={(el) => { wires.current[0] = el; }} size={[size, OBJ.plate, size]} position={[0, L.yPlate, 0]} rotationY={rest + (OBJ.twist[0] + OBJ.twist[1]) / 2} width={1} opacity={0} />
          <WireBox ref={(el) => { wires.current[1] = el; }} size={[size, L.h, size]} position={[0, L.ySlab1, 0]} rotationY={rest + OBJ.twist[1]} opacity={0} />
          <WireBox ref={(el) => { wires.current[2] = el; }} size={[size, L.h, size]} position={[0, L.ySlab2, 0]} rotationY={rest + OBJ.twist[2]} opacity={0} />
        </>
      )}
    </group>
  );
}
