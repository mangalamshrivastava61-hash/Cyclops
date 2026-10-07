"use client";

import { useLayoutEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OracleObject } from "./OracleObject";
import { AuthorityStack } from "./AuthorityStack";
import { CircuitDial } from "./CircuitDial";
import { ProductBox } from "./ProductBox";
import { Studio } from "./Studio";
import { VIEWS, cameraPosition, type CameraView, type SceneProps } from "./views";

function CameraRig({ view }: { view: CameraView }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const pullBack = view.fitAspect && aspect < view.fitAspect ? view.fitAspect / aspect : 1;
  useLayoutEffect(() => {
    camera.position.set(...cameraPosition({ ...view, distance: view.distance * pullBack }));
    camera.lookAt(...view.target);
    camera.updateProjectionMatrix();
  }, [camera, view, pullBack]);
  return null;
}

/** One canvas per object view. Loaded lazily, so Three.js never blocks the first paint. */
export default function Scene(props: SceneProps) {
  const view = { ...VIEWS[props.variant], ...props.view };
  return (
    <Canvas
      shadows="variance"
      dpr={[1, 2]}
      frameloop={props.frameloop === "never" ? "never" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: view.fov, near: 0.1, far: 200, position: cameraPosition(view) }}
      onCreated={() => props.onReady?.()}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig view={view} />
      <Studio shadowSize={props.variant === "circuit" ? 6 : 9} shadowOpacity={props.variant === "circuit" ? 0.2 : 0.17} />
      <Content {...props} />
    </Canvas>
  );
}

function Content(p: SceneProps) {
  switch (p.variant) {
    case "hero":
      return <OracleObject pose={{ liftTop: 0.7, liftTwist: 0.32, ...p.pose }} ring size={2.3} height={2.5} float={p.float !== false} />;
    case "forecast":
      return <OracleObject pose={{ explode: 0.2, ...p.pose }} float={p.float} />;
    case "stress":
      return <OracleObject pose={p.pose ?? { shear: 1, lift: 0.34 }} outline float={p.float} />;
    case "authority":
      return <AuthorityStack level={p.authorityLevel ?? 2} focus={p.authorityFocus ?? null} />;
    case "circuit":
      return <CircuitDial state={p.circuitState ?? "clear"} anchorRootRef={p.anchorRootRef} />;
    case "product":
      return <ProductBox float={p.float !== false} />;
    default:
      return <OracleObject pose={p.pose ?? {}} float={p.float} />;
  }
}
