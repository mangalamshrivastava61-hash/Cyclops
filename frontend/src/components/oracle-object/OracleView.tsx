"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";
import type { SceneProps } from "./views";

const FADE = "linear-gradient(to right, #000 84%, transparent 100%), linear-gradient(to bottom, #000 86%, transparent 100%)";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

let webglSupport: boolean | undefined;
function hasWebGL() {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement("canvas");
      webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const never = () => () => {};
/** true / false once known on the client; null during server render. */
export const useWebGL = () => useSyncExternalStore(never, hasWebGL, () => null);
const REDUCED = "(prefers-reduced-motion: reduce)";
const onReducedChange = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

type Props = Omit<SceneProps, "frameloop" | "onReady" | "anchors"> & {
  /** DOM elements pinned to scene points (circuit labels); rendered over the canvas */
  overlay?: ReactNode;
  className?: string;
  /** Soften the right and bottom edges so long shadows never end on a hard line */
  fadeEdges?: boolean;
  /** What the object shows, for screen readers */
  label: string;
  /** Pre-rendered still used when WebGL is unavailable */
  fallback?: string;
};

/**
 * The ORACLE object in any of its states. Mounts its canvas only when scrolled into view,
 * pauses rendering when off screen, and fades in once the first frame is ready.
 */
export function OracleView({ className, label, fallback, fadeEdges = true, overlay, ...scene }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  // client-only facts; the server renders neither the canvas nor the fallback
  const webgl = useWebGL();
  const reduced = useSyncExternalStore(onReducedChange, () => window.matchMedia(REDUCED).matches, () => false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setMounted(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} role={scene.variant === "circuit" ? "group" : "img"} aria-label={label} className={cx("relative", className)}>
      {webgl === false && fallback && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fallback} alt="" className="absolute inset-0 h-full w-full object-contain" />
      )}
      {webgl && mounted && (
        <div
          className={cx("absolute inset-0 transition-opacity duration-700 ease-[var(--ease-product)]", ready ? "opacity-100" : "opacity-0")}
          style={fadeEdges ? { maskImage: FADE, WebkitMaskImage: FADE, maskComposite: "intersect", WebkitMaskComposite: "source-in" } : undefined}
        >
          <Scene {...scene} anchorRootRef={overlay ? labels : undefined} float={reduced ? false : scene.float} frameloop={visible ? "always" : "never"} onReady={() => setReady(true)} />
        </div>
      )}
      {overlay && webgl && mounted && (
        <div ref={labels} className="pointer-events-none absolute inset-0">
          {overlay}
        </div>
      )}
    </div>
  );
}
