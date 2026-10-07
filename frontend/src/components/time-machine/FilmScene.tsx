"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, CylinderGeometry, Group, Mesh } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { replayMonths, type DatasetReplay } from "@/lib/replay";
import { Studio } from "@/components/oracle-object/Studio";
import { useMaterials } from "@/components/oracle-object/materials";
import { damp } from "@/components/oracle-object/dims";
import { Anchors, type AnchorRoot } from "@/components/oracle-object/Anchors";

const STEP = 0.34;
const X0 = -14;
const EXTRA_SEALED = 11; // days beyond the replay window that stay sealed
const tileX = (i: number) => X0 + i * STEP;
const heightFor = (units: number) => 0.35 + units * 0.055;

interface Props {
  replay: DatasetReplay;
  revealed: number;
  anchorRootRef: AnchorRoot;
  frameloop: "always" | "never";
  onReady?: () => void;
}

/**
 * The Time Machine as a physical rail of days. Known days stand in ivory, the decision day in gold.
 * The future is sealed in a closed case; each revealed day slides out in ink.
 */
export default function FilmScene({ replay, revealed, anchorRootRef, frameloop, onReady }: Props) {
  return (
    <Canvas shadows="variance" dpr={[1, 2]} frameloop={frameloop === "never" ? "never" : "demand"} gl={{ antialias: true, alpha: true }} camera={{ fov: 15, near: 0.1, far: 300 }} onCreated={() => onReady?.()} style={{ position: "absolute", inset: 0 }}>
      <FilmCamera revealed={revealed} />
      <Studio shadowSize={24} shadowOpacity={0.15} keyPos={[-6, 12, 10]} />
      <Rail replay={replay} revealed={revealed} anchorRootRef={anchorRootRef} />
    </Canvas>
  );
}

function FilmCamera({ revealed }: { revealed: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const cur = useRef(revealed);
  const dir = useMemo(() => {
    const v = [-0.62, 0.2, 0.76];
    const n = Math.hypot(...v);
    return v.map((x) => x / n);
  }, []);
  useFrame((state, dt) => {
    cur.current = damp(cur.current, revealed, 2.4, dt);
    // narrow screens pull back and follow the reveal head, so the decision, the head and the case stay in frame
    const narrow = size.width < 700;
    const dist = narrow ? 33 : size.width < 900 ? 27 : 21;
    const tx = narrow ? 5.3 + cur.current * STEP * 0.55 : 4.6 + cur.current * STEP * 0.35;
    camera.position.set(tx + dir[0] * dist, 0.95 + dir[1] * dist, dir[2] * dist);
    camera.lookAt(tx, 0.95, 0);
    if (Math.abs(cur.current - revealed) > 1e-3) state.invalidate();
  });
  return null;
}

function Rail({ replay, revealed, anchorRootRef }: { replay: DatasetReplay; revealed: number; anchorRootRef: AnchorRoot }) {
  const M = useMaterials();
  const invalidate = useThree((s) => s.invalidate);
  const dec = Math.max(0, replay.known.length - 1); // the decision day is the last known day
  const windowDays = replay.window.length;
  const totalDays = dec + windowDays + EXTRA_SEALED;
  const railLen = totalDays * STEP + 1.2;
  const railX = X0 + railLen / 2 - 0.6;

  const geo = useMemo(
    () => ({
      rail: new RoundedBoxGeometry(railLen, 0.3, 2.0, 4, 0.05),
      groove: new BoxGeometry(railLen - 0.2, 0.022, 0.012),
      tick: new BoxGeometry(0.025, 0.2, 0.012),
      tile: new RoundedBoxGeometry(0.1, 1, 1.2, 2, 0.03),
      caseBody: new RoundedBoxGeometry(1, 2.05, 1.7, 4, 0.06),
      seal: new RoundedBoxGeometry(0.1, 2.08, 1.73, 3, 0.03),
      carriage: new RoundedBoxGeometry(0.24, 0.42, 2.2, 3, 0.04),
      needle: new CylinderGeometry(0.014, 0.014, 2.5, 12),
    }),
    [railLen],
  );
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  useEffect(() => invalidate(), [invalidate, revealed]);

  const futureTiles = useRef<(Mesh | null)[]>([]);
  const caseRef = useRef<Mesh>(null);
  const sealRef = useRef<Group>(null);
  const cur = useRef(revealed);
  const grow = useRef<number[]>(replay.window.map((_, i) => (i < revealed ? 1 : 0)));

  const caseEnd = X0 + totalDays * STEP + 0.5;
  const frontAt = (r: number) => X0 + (dec + r) * STEP + STEP * 0.9;

  useFrame((state, dt) => {
    cur.current = damp(cur.current, revealed, 3, dt);
    let moving = Math.abs(cur.current - revealed) > 1e-3;
    replay.window.forEach((d, i) => {
      grow.current[i] = damp(grow.current[i], i < revealed ? 1 : 0, 4, dt);
      moving ||= Math.abs(grow.current[i] - (i < revealed ? 1 : 0)) > 1e-3;
      const m = futureTiles.current[i];
      if (!m) return;
      const h = heightFor(d.units) * Math.max(0.001, grow.current[i]);
      m.scale.y = h;
      m.position.y = 0.3 + h / 2;
      m.visible = grow.current[i] > 0.01;
    });
    const front = frontAt(cur.current);
    const len = caseEnd - front;
    if (caseRef.current) {
      caseRef.current.scale.x = len;
      caseRef.current.position.x = front + len / 2;
    }
    if (sealRef.current) sealRef.current.position.x = front;
    if (moving) state.invalidate();
  });

  const months = replayMonths(replay);
  const decX = tileX(dec);
  const decH = (replay.known[dec] ? heightFor(replay.known[dec].units) : 0.5) + 0.35;

  return (
    <group>
      <mesh geometry={geo.rail} material={M.ivory} position={[railX, 0.15, 0]} castShadow receiveShadow />
      <mesh geometry={geo.groove} material={M.ink} position={[railX, 0.19, 1.003]} />
      {months.map((m) => (
        <group key={m.key}>
          <mesh geometry={geo.tick} material={M.ink} position={[tileX(m.day), 0.15, 1.006]} />
        </group>
      ))}

      {/* known days and the decision day */}
      {replay.known.map((d, i) => {
        const h = heightFor(d.units) + (i === dec ? 0.35 : 0);
        return <mesh key={d.date} geometry={geo.tile} material={i === dec ? M.gold : M.ivory} position={[tileX(i), 0.3 + h / 2, 0]} scale={[1, h, 1]} castShadow receiveShadow />;
      })}

      {/* revealed days rise out of the case in ink */}
      {replay.window.map((d, i) => (
        <mesh
          key={d.date}
          ref={(el) => {
            futureTiles.current[i] = el;
          }}
          geometry={geo.tile}
          material={M.black}
          position={[tileX(dec + 1 + i), 0.3, 0]}
          castShadow
          receiveShadow
        />
      ))}

      {/* the sealed future */}
      <mesh ref={caseRef} geometry={geo.caseBody} material={M.ivory} position={[caseEnd - 2, 0.3 + 1.025, 0]} castShadow receiveShadow />
      <group ref={sealRef} position-x={frontAt(revealed)}>
        <mesh geometry={geo.seal} material={M.black} position={[0.18, 0.3 + 1.04, 0]} castShadow />
        <mesh geometry={geo.carriage} material={M.black} position={[-STEP * 0.45, 0.3, 0]} castShadow />
        <mesh geometry={geo.needle} material={M.ink} position={[-STEP * 0.45, 0.3 + 1.25, 0.95]} />
      </group>

      <Anchors
        rootRef={anchorRootRef}
        points={{
          ...Object.fromEntries(months.map((m) => [`m-${m.key}`, () => [tileX(m.day), 0.0, 1.0] as [number, number, number]])),
          decision: () => [decX, 0.3 + decH + 0.12, 0],
          head: () => [frontAt(cur.current) - STEP * 0.45, 0.3 + 2.5, 0.95],
          sealed: () => [frontAt(cur.current) + 1.0, 0.3 + 1.6, 0.9],
        }}
      />
    </group>
  );
}
