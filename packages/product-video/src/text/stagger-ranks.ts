import type { StaggerMode } from "../catalogues/text-effects/text-effect-schema";

/** The stagger slot of each of `count` animated units, in unit order. */
export function staggerRanks(count: number, mode: StaggerMode): number[] {
  const indices = Array.from({ length: count }, (_, index) => index);
  switch (mode) {
    case "normal":
      return indices;
    case "reverse":
      return indices.map((index) => count - 1 - index);
    case "center-out": {
      const center = (count - 1) / 2;
      const order = [...indices].sort((a, b) => Math.abs(a - center) - Math.abs(b - center) || a - b);
      return ranksFromOrder(order);
    }
    case "edges-in": {
      const order: number[] = [];
      for (let left = 0, right = count - 1; left <= right; left++, right--) {
        order.push(left);
        if (right !== left) order.push(right);
      }
      return ranksFromOrder(order);
    }
  }
}

function ranksFromOrder(order: readonly number[]): number[] {
  const ranks = new Array<number>(order.length);
  order.forEach((unitIndex, rank) => {
    ranks[unitIndex] = rank;
  });
  return ranks;
}
