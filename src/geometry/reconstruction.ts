import { projectBlocks, validateBuilding, type Block, type BlockView, type ProjectedCell } from './blocks';
import { CONSTRUCTION_LIMITS } from './construction';

export interface ReconstructionTask {
  id: string;
  label: string;
  description: string;
  hint: string;
  projections: Record<BlockView, readonly ProjectedCell[]>;
}
export interface ProjectionMatch { matches: boolean; missing: number; extra: number }
export interface ReconstructionMatch {
  matches: boolean;
  valid: boolean;
  views: Record<BlockView, ProjectionMatch>;
}
export const RECONSTRUCTION_VIEWS: readonly BlockView[] = ['front', 'side', 'top'];

// Explicit projection cells are the problem. No particular hidden source
// building is used for grading, so every supported solution can be accepted.
export const RECONSTRUCTION_TASKS: readonly ReconstructionTask[] = [
  {
    id: 'corner', label: 'かどのたてもの',
    description: '前・右よこ・上の３つの図と、同じ見え方になる建物を作ろう。',
    hint: '上の図で、ブロックを置く場所を先にきめよう。前と右よこの図で、高さを考えるよ。',
    projections: {
      front: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }],
      side: [{ u: -1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 1 }],
      top: [{ u: 0, v: -1 }, { u: 0, v: 0 }, { u: 1, v: 0 }],
    },
  },
  {
    id: 'square', label: '四角いひろば',
    description: '３つの図を手がかりに、四角いひろばに建物を作ろう。どこを高くすると合うかな？',
    hint: '上からは、４つの場所にブロックが見えるね。前と右よこの図で、２だんめが見えるようにしてみよう。',
    projections: {
      front: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 }, { u: 1, v: 1 }],
      side: [{ u: -1, v: 0 }, { u: 0, v: 0 }, { u: -1, v: 1 }, { u: 0, v: 1 }],
      top: [{ u: 0, v: -1 }, { u: 1, v: -1 }, { u: 0, v: 0 }, { u: 1, v: 0 }],
    },
  },
  {
    id: 'stairs', label: 'かいだんのきち',
    description: '３だんまで使って、３つの図に合う建物を作ろう。上の図の場所も見てね。',
    hint: '前の図の高さは、左から１・２・３だん。上の図を見て、どの場所に積めばいいか考えよう。',
    projections: {
      front: [{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 2, v: 0 }, { u: 1, v: 1 }, { u: 2, v: 1 }, { u: 2, v: 2 }],
      side: [{ u: -1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 1 }, { u: 0, v: 2 }],
      top: [{ u: 2, v: -1 }, { u: 0, v: 0 }, { u: 1, v: 0 }, { u: 2, v: 0 }],
    },
  },
];

export function matchProjection(actual: readonly ProjectedCell[], expected: readonly ProjectedCell[]): ProjectionMatch {
  const occupied = new Set(actual.map(({ u, v }) => `${u},${v}`));
  const target = new Set(expected.map(({ u, v }) => `${u},${v}`));
  const missing = [...target].filter((key) => !occupied.has(key)).length;
  const extra = [...occupied].filter((key) => !target.has(key)).length;
  return { matches: missing === 0 && extra === 0, missing, extra };
}

export function validateReconstruction(blocks: readonly Block[], task: ReconstructionTask): ReconstructionMatch {
  const valid = blocks.length <= CONSTRUCTION_LIMITS.width * CONSTRUCTION_LIMITS.depth * CONSTRUCTION_LIMITS.height
    && blocks.every(({ x, y, z }) => Number.isInteger(x) && x >= 0 && x < CONSTRUCTION_LIMITS.width
      && Number.isInteger(y) && y >= 0 && y < CONSTRUCTION_LIMITS.height
      && Number.isInteger(z) && z >= 0 && z < CONSTRUCTION_LIMITS.depth)
    && validateBuilding(blocks).length === 0;
  const views = Object.fromEntries(RECONSTRUCTION_VIEWS.map((view) =>
    [view, matchProjection(projectBlocks(blocks, view), task.projections[view])])) as Record<BlockView, ProjectionMatch>;
  return { valid, views, matches: valid && RECONSTRUCTION_VIEWS.every((view) => views[view].matches) };
}
