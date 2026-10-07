"use client";

import { forwardRef, useMemo } from "react";
import { Line } from "@react-three/drei";
import type { Line2, LineSegments2 } from "three-stdlib";
import { MAT } from "@/lib/tokens";

/** A box drawn in fine ink lines: planned, not built. */
export const WireBox = forwardRef<Line2 | LineSegments2, { size: [number, number, number]; position?: [number, number, number]; rotationY?: number; width?: number; opacity?: number }>(
  function WireBox({ size, position = [0, 0, 0], rotationY = 0, width = 1.15, opacity = 1 }, ref) {
    const points = useMemo(() => {
      const [x, y, z] = size.map((v) => v / 2);
      const c: [number, number, number][] = [
        [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z],
        [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z],
      ];
      const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
      return e.flatMap(([a, b]) => [c[a], c[b]]);
    }, [size]);
    return (
      <group position={position} rotation-y={rotationY}>
        <Line ref={ref} points={points} segments lineWidth={width} color={MAT.line} transparent opacity={opacity} depthWrite={false} />
      </group>
    );
  },
);
