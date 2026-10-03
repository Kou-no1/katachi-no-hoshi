import type { Block } from './blocks';

export const CONSTRUCTION_LIMITS = { width: 3, depth: 3, height: 3 } as const;
export type ColumnAction = 'add' | 'remove';

const blockKey = ({ x, y, z }: Block) => `${x},${y},${z}`;
const validColumn = (x: number, z: number) => Number.isInteger(x) && Number.isInteger(z)
  && x >= 0 && x < CONSTRUCTION_LIMITS.width && z >= 0 && z < CONSTRUCTION_LIMITS.depth;
const validBlock = ({ x, y, z }: Block) => validColumn(x, z)
  && Number.isInteger(y) && y >= 0 && y < CONSTRUCTION_LIMITS.height;

function validConstruction(blocks: readonly Block[]): boolean {
  const occupied = new Set(blocks.map(blockKey));
  return occupied.size === blocks.length && blocks.every((block) => validBlock(block)
    && (block.y === 0 || occupied.has(blockKey({ ...block, y: block.y - 1 }))));
}

/** Height is measured in cubes, with an empty column having height zero. */
export function columnHeight(blocks: readonly Block[], x: number, z: number): number {
  if (!validColumn(x, z)) return 0;
  return blocks.reduce((height, block) => block.x === x && block.z === z && validBlock(block)
    ? Math.max(height, block.y + 1) : height, 0);
}

/** Only the top cube can change. Invalid input is copied without being repaired. */
export function editColumn(blocks: readonly Block[], x: number, z: number, action: ColumnAction): Block[] {
  const result = blocks.map((block) => ({ ...block }));
  if (!validColumn(x, z) || !validConstruction(blocks)) return result;
  const height = columnHeight(blocks, x, z);
  if (action === 'add') {
    if (height < CONSTRUCTION_LIMITS.height) result.push({ x, y: height, z });
  } else if (action === 'remove' && height > 0) {
    const index = result.findIndex((block) => block.x === x && block.z === z && block.y === height - 1);
    result.splice(index, 1);
  }
  return result;
}

/** Coordinate differences are counted once. Order is irrelevant; orientation and origin are fixed. */
export function matchConstruction(blocks: readonly Block[], target: readonly Block[]): { matches: boolean; missing: number; extra: number } {
  const occupied = new Set(blocks.map(blockKey));
  const expected = new Set(target.map(blockKey));
  const missing = [...expected].filter((key) => !occupied.has(key)).length;
  const extra = [...occupied].filter((key) => !expected.has(key)).length;
  return {
    matches: missing === 0 && extra === 0 && validConstruction(blocks) && validConstruction(target),
    missing,
    extra,
  };
}
