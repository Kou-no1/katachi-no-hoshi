export interface Block {
  x: number;
  y: number;
  z: number;
}

export type BlockView = 'front' | 'side' | 'top';
export interface ProjectedCell { u: number; v: number }
export interface Building { id: string; name: string; blocks: readonly Block[] }

// x is right, y is up, z is toward the viewer in the front view.
// In a right-side view screen-right is -z. In a top view screen-up is -z.
export function projectBlocks(blocks: readonly Block[], view: BlockView): ProjectedCell[] {
  const cells = new Map<string, ProjectedCell>();
  for (const { x, y, z } of blocks) {
    const cell = view === 'front' ? { u: x, v: y }
      : view === 'side' ? { u: z === 0 ? 0 : -z, v: y }
        : { u: x, v: z === 0 ? 0 : -z };
    cells.set(`${cell.u},${cell.v}`, cell);
  }
  return [...cells.values()].sort((a, b) => a.v - b.v || a.u - b.u);
}

export function countBlocks(blocks: readonly Block[]): number {
  return new Set(blocks.map(({ x, y, z }) => `${x},${y},${z}`)).size;
}

export function blocksInLayer(blocks: readonly Block[], layer: number): Block[] {
  return blocks.filter((block) => block.y === layer);
}

export function validateBuilding(blocks: readonly Block[]): string[] {
  const errors: string[] = [];
  const keys = new Set(blocks.map(({ x, y, z }) => `${x},${y},${z}`));
  if (blocks.length === 0) errors.push('The building is empty.');
  if (keys.size !== blocks.length) errors.push('Blocks overlap.');
  for (const { x, y, z } of blocks) {
    if (![x, y, z].every((value) => Number.isInteger(value) && value >= 0)) {
      errors.push('Coordinates must be nonnegative integers.');
    }
    if (y > 0 && !keys.has(`${x},${y - 1},${z}`)) errors.push('An upper block has no supporting block.');
  }
  return errors;
}

export const BUILDINGS: readonly Building[] = [
  {
    id: 'little-house', name: 'ちいさなおうち',
    blocks: [
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 },
    ],
  },
  {
    id: 'lookout', name: 'みはりだい',
    blocks: [
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
    ],
  },
  {
    id: 'space-base', name: 'うちゅうきち',
    blocks: [
      { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 },
      { x: 0, y: 1, z: 0 }, { x: 2, y: 1, z: 1 },
    ],
  },
];
