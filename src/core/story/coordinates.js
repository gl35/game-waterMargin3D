const ORIGIN_X = 9;
const ORIGIN_Y = 16;
const SCALE_X = 1.8;
const SCALE_Z = 1.5;
const WORLD_Z_OFFSET = 12;

export function tileToWorldPosition({ x, y }) {
  return {
    x: (x - ORIGIN_X) * SCALE_X,
    z: (ORIGIN_Y - y) * SCALE_Z + WORLD_Z_OFFSET,
  };
}
