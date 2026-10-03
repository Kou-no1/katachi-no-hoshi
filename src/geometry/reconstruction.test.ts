import { describe, expect, it } from 'vitest';
import { projectBlocks, type Block } from './blocks';
import { editColumn } from './construction';
import { matchProjection, RECONSTRUCTION_TASKS, validateReconstruction } from './reconstruction';

// Independent coordinates: these solutions are not generated from the task's
// projection data and never become a hidden coordinate target for grading.
const corner: Block[] = [
  { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 },
  { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 },
];
const diagonalTowers: Block[] = [
  { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
  { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 1 },
];
const solidSquare: Block[] = [
  { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 },
  { x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 },
  { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 },
  { x: 0, y: 1, z: 1 }, { x: 1, y: 1, z: 1 },
];
const stairs: Block[] = [
  { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 },
  { x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }, { x: 2, y: 2, z: 0 },
  { x: 2, y: 0, z: 1 },
];

describe('reconstruction from three fixed projections', () => {
  it('accepts explicit supported solutions for each of the three tasks', () => {
    for (const [index, solution] of [corner, diagonalTowers, stairs].entries()) {
      const result = validateReconstruction(solution, RECONSTRUCTION_TASKS[index]);
      expect(result.valid).toBe(true);
      expect(result.matches).toBe(true);
      expect(Object.values(result.views)).toEqual(Array.from({ length: 3 }, () => ({ matches: true, missing: 0, extra: 0 })));
    }
  });

  it('accepts two different cube counts with the same projections instead of requiring a hidden model', () => {
    expect(diagonalTowers).toHaveLength(6);
    expect(solidSquare).toHaveLength(8);
    expect(validateReconstruction(diagonalTowers, RECONSTRUCTION_TASKS[1]).matches).toBe(true);
    expect(validateReconstruction(solidSquare, RECONSTRUCTION_TASKS[1]).matches).toBe(true);
    for (const view of ['front', 'side', 'top'] as const) {
      expect(projectBlocks(diagonalTowers, view)).toEqual(projectBlocks(solidSquare, view));
    }
  });

  it('can reach every solution using the nine floor cells and supported column edits', () => {
    for (const [index, heights] of [[2, 1, 0, 1, 0, 0, 0, 0, 0], [2, 1, 0, 1, 2, 0, 0, 0, 0], [1, 2, 3, 0, 0, 1, 0, 0, 0]].entries()) {
      let blocks: Block[] = [];
      heights.forEach((height, cell) => {
        for (let count = 0; count < height; count++) blocks = editColumn(blocks, cell % 3, Math.floor(cell / 3), 'add');
      });
      expect(validateReconstruction(blocks, RECONSTRUCTION_TASKS[index]).matches).toBe(true);
    }
  });

  it('keeps origin and right-side handedness instead of normalizing or mirroring silhouettes', () => {
    expect(projectBlocks(stairs, 'side')).toEqual([
      { u: -1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 1 }, { u: 0, v: 2 },
    ]);
    const shifted = corner.map((block) => ({ ...block, x: block.x + 1 }));
    expect(validateReconstruction(shifted, RECONSTRUCTION_TASKS[0]).matches).toBe(false);
    const mirrored = corner.map((block) => ({ ...block, z: 1 - block.z }));
    const result = validateReconstruction(mirrored, RECONSTRUCTION_TASKS[0]);
    expect(result.valid).toBe(true);
    expect(result.views.front.matches).toBe(true);
    expect(result.views.top.matches).toBe(false);
    expect(result.views.side).toEqual({ matches: false, missing: 1, extra: 1 });
  });

  it('reports a missing side-view cell even when front and top still match', () => {
    const oneTower = solidSquare.filter((block) => !(block.y === 1 && block.z === 1));
    const result = validateReconstruction(oneTower, RECONSTRUCTION_TASKS[1]);
    expect(result.valid).toBe(true);
    expect(result.views.top.matches).toBe(true);
    expect(result.views.front.matches).toBe(true);
    expect(result.views.side).toEqual({ matches: false, missing: 1, extra: 0 });
    expect(result.matches).toBe(false);
  });

  it('compares cells as sets, with meaningful missing and extra counts', () => {
    expect(matchProjection([{ u: 0, v: 0 }, { u: 1, v: 0 }], [{ u: 0, v: 1 }, { u: 0, v: 0 }])).toEqual({ matches: false, missing: 1, extra: 1 });
    expect(matchProjection([{ u: 1, v: 0 }, { u: 0, v: 0 }], [{ u: 0, v: 0 }, { u: 1, v: 0 }]).matches).toBe(true);
  });

  it('rejects floating cubes even if all three silhouettes look correct', () => {
    const floating = solidSquare.filter((block) => !(block.x === 0 && block.y === 0 && block.z === 0));
    const result = validateReconstruction(floating, RECONSTRUCTION_TASKS[1]);
    expect(Object.values(result.views).every((view) => view.matches)).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.matches).toBe(false);
  });

  it('rejects duplicates and out-of-range or non-integer blocks', () => {
    expect(validateReconstruction([...corner, { ...corner[0] }], RECONSTRUCTION_TASKS[0]).matches).toBe(false);
    for (const invalid of [
      { x: 3, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: -1 },
      { x: .5, y: 0, z: 0 }, { x: 0, y: NaN, z: 0 },
    ]) expect(validateReconstruction([...corner, invalid], RECONSTRUCTION_TASKS[0]).valid).toBe(false);
    expect(validateReconstruction([], RECONSTRUCTION_TASKS[0]).valid).toBe(false);
  });
});
