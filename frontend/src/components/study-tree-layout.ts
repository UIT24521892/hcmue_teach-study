/* Geometry of the study tree on its 420×300 canvas, shared by the drawing and the garden. */

export interface TreeLeafPlacement {
  /** Leaf base on the 420×300 tree canvas. */
  x: number;
  y: number;
  /** Rotation in degrees; the leaf blade points along local -y. */
  angle: number;
  /** Position on its branch, which picks the leaf color. */
  leafIndex: number;
}

const SEEDLING_LEAF: TreeLeafPlacement = { x: 208, y: 240, angle: -40, leafIndex: 1 };

export function branchGeometry(leaves: number, index: number) {
  const side = index % 2 === 0 ? -1 : 1;
  const tier = Math.floor(index / 2);
  const y = 236 - tier * 30;
  const reach = 95 - tier * 7;
  const count = Math.min(10, leaves - index * 10);
  return { side, y, reach, count };
}

/**
 * Where every leaf of a tree with `leaves` leaves sits, in drawing order. A
 * tree with no leaves is a seedling with one sprout leaf.
 */
export function treeLeafLayout(leaves: number): TreeLeafPlacement[] {
  if (leaves <= 0) return [SEEDLING_LEAF];
  const placements: TreeLeafPlacement[] = [];
  for (let index = 0; index < Math.ceil(leaves / 10); index += 1) {
    const { side, y, reach, count } = branchGeometry(leaves, index);
    for (let leafIndex = 0; leafIndex < count; leafIndex += 1) {
      const t = 0.3 + Math.floor(leafIndex / 2) * 0.15;
      placements.push({
        x: 210 + side * reach * (1.2 * t - 0.2 * t * t),
        y: y - 48 * t - 21 * t * t,
        angle: side * (leafIndex % 2 === 0 ? 8 : 104),
        leafIndex,
      });
    }
  }
  return placements;
}
