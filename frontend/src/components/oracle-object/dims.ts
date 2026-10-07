/** Shared proportions of the ORACLE object: a monolith cut into low / expected / high, with a gold decision plate. */
export const OBJ = {
  size: 2,
  height: 2.15,
  plate: 0.05,
  gap: 0.03,
  rest: -0.55, // resting rotation that shows two faces
  twist: [0, 0.07, 0.14] as const,
};

export function layerHeights(size = OBJ.size, height = OBJ.height) {
  const h = (height - 2 * OBJ.gap - OBJ.plate) / 3;
  return {
    h,
    radius: size * 0.028,
    yBase: h / 2,
    yPlate: h + OBJ.gap / 2 + OBJ.plate / 2,
    ySlab1: h + OBJ.gap + OBJ.plate + h / 2,
    ySlab2: h + OBJ.gap + OBJ.plate + h / 2 + h + OBJ.gap,
  };
}

/** Screen-right for the standard camera: the direction stress pushes the layers. */
export const SHEAR_DIR: [number, number, number] = [0.79, 0, -0.61];

export const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * Math.min(dt, 0.1)));
