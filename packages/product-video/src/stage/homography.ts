type Point = [number, number];

/** A 3 × 3 projective map, row-major: `[x', y', w'] = H · [x, y, 1]`. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** The map taking each of four points to its partner, or null when three of them are in line. */
export function fitHomography(from: Point[], to: Point[]): Homography | null {
  // Eight equations in h0..h7 with h8 = 1, solved by Gaussian elimination with partial pivoting.
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i] ?? [0, 0];
    const [u, v] = to[i] ?? [0, 0];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-12) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row][column] / rows[column][column];
      for (let k = column; k < 9; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  const h = rows.map((row, index) => row[8] / row[index]);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** `[x, y]` mapped through `h`; `w` is negative on the far side of the plane's horizon. */
export function applyHomography(h: Homography, [x, y]: Point): { x: number; y: number; w: number } {
  const w = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w, w };
}
