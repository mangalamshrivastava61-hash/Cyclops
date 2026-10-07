"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Soft studio: a room environment for reflections, one warm key light casting a long soft shadow. */
export function Studio({ shadowOpacity = 0.17, shadowSize = 9, keyPos = [-5, 12, 4] as [number, number, number], groundY = 0 }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene, invalidate } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.75;
    invalidate();
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [get]);

  const s = shadowSize;
  return (
    <>
      <hemisphereLight args={["#fffaf0", "#d9cfbd", 0.35]} />
      <directionalLight
        position={keyPos}
        intensity={2.6}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={12}
        shadow-blurSamples={20}
        shadow-bias={-0.0004}
        shadow-camera-left={-s}
        shadow-camera-right={s}
        shadow-camera-top={s}
        shadow-camera-bottom={-s}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.6} />
      <mesh rotation-x={-Math.PI / 2} position-y={groundY} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <shadowMaterial transparent opacity={shadowOpacity} color="#3a3226" />
      </mesh>
    </>
  );
}
