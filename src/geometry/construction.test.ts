import { describe, expect, it } from 'vitest';
import { BUILDINGS, projectBlocks, validateBuilding, type Block } from './blocks';
import { columnHeight, CONSTRUCTION_LIMITS, editColumn, matchConstruction } from './construction';

describe('supported column editing', () => {
  it('adds from the floor upward and removes only the highest cube', () => {
    let blocks: Block[] = [];
    blocks = editColumn(blocks, 1, 2, 'add');
    blocks = editColumn(blocks, 1, 2, 'add');
    blocks = editColumn(blocks, 1, 2, 'add');
    expect(blocks).toEqual([{ x: 1, y: 0, z: 2 }, { x: 1, y: 1, z: 2 }, { x: 1, y: 2, z: 2 }]);
    expect(columnHeight(blocks, 1, 2)).toBe(3);
    expect(validateBuilding(blocks)).toEqual([]);
    blocks = editColumn(blocks, 1, 2, 'remove');
    expect(blocks).toEqual([{ x: 1, y: 0, z: 2 }, { x: 1, y: 1, z: 2 }]);
    expect(columnHeight(blocks, 1, 2)).toBe(2);
    expect(validateBuilding(blocks)).toEqual([]);
  });

  it('caps every column at three cubes and can safely empty the whole 3 × 3 floor', () => {
    let blocks: Block[] = [];
    for (let x = 0; x < CONSTRUCTION_LIMITS.width; x++) for (let z = 0; z < CONSTRUCTION_LIMITS.depth; z++) {
      for (let count = 0; count < 5; count++) blocks = editColumn(blocks, x, z, 'add');
      expect(columnHeight(blocks, x, z)).toBe(3);
      expect(validateBuilding(blocks)).toEqual([]);
    }
    expect(blocks).toHaveLength(27);
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
      for (let count = 0; count < 4; count++) blocks = editColumn(blocks, x, z, 'remove');
      expect(columnHeight(blocks, x, z)).toBe(0);
    }
    expect(blocks).toEqual([]);
  });

  it.each([[-1, 0], [3, 0], [0, -1], [0, 3], [.5, 1], [1, .5], [NaN, 0], [0, Infinity]])('ignores an invalid column (%s, %s)', (x, z) => {
    const blocks = [{ x: 0, y: 0, z: 0 }];
    for (const action of ['add', 'remove'] as const) {
      const edited = editColumn(blocks, x, z, action);
      expect(edited).toEqual(blocks);
      expect(edited).not.toBe(blocks);
      expect(edited[0]).not.toBe(blocks[0]);
    }
    expect(columnHeight(blocks, x, z)).toBe(0);
  });

  it('leaves other columns intact and never mutates the source or its cubes', () => {
    const blocks: readonly Block[] = Object.freeze([
      Object.freeze({ x: 0, y: 0, z: 0 }), Object.freeze({ x: 2, y: 0, z: 2 }),
    ]);
    const added = editColumn(blocks, 2, 2, 'add');
    expect(added).toEqual([{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, { x: 2, y: 1, z: 2 }]);
    const removed = editColumn(added, 2, 2, 'remove');
    expect(removed).toEqual(blocks);
    added[0].x = 1;
    expect(blocks[0].x).toBe(0);
    expect(removed[0].x).toBe(0);
  });

  it('copies an invalid floating construction without adding another floating cube', () => {
    const floating = [{ x: 0, y: 1, z: 0 }];
    expect(editColumn(floating, 0, 0, 'add')).toEqual(floating);
    expect(editColumn(floating, 0, 0, 'remove')).toEqual(floating);
  });
});

describe('matching a fixed building', () => {
  it.each(BUILDINGS)('can construct all cubes of $name using only supported edits', ({ blocks: target }) => {
    let blocks: Block[] = [];
    for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) {
      for (let height = 0; height < columnHeight(target, x, z); height++) blocks = editColumn(blocks, x, z, 'add');
    }
    expect(matchConstruction(blocks, target)).toEqual({ matches: true, missing: 0, extra: 0 });
    expect(matchConstruction([...blocks].reverse(), target).matches).toBe(true);
  });

  it('counts missing and extra positions separately even when total cube count is unchanged', () => {
    const target = BUILDINGS[0].blocks;
    const blocks = target.filter((block) => !(block.x === 1 && block.y === 0 && block.z === 0));
    blocks.push({ x: 2, y: 0, z: 2 });
    expect(blocks.length).toBe(target.length);
    expect(matchConstruction(blocks, target)).toEqual({ matches: false, missing: 1, extra: 1 });
  });

  it('does not accept a matching front silhouette with a missing cube', () => {
    const target = BUILDINGS[1].blocks;
    const blocks = target.filter((block) => !(block.x === 1 && block.y === 0 && block.z === 1));
    expect(validateBuilding(blocks)).toEqual([]);
    expect(projectBlocks(blocks, 'front')).toEqual(projectBlocks(target, 'front'));
    expect(matchConstruction(blocks, target)).toEqual({ matches: false, missing: 1, extra: 0 });
  });

  it('requires the original orientation and origin', () => {
    const target = BUILDINGS[2].blocks;
    const rotated = target.map(({ x, y, z }) => ({ x: z, y, z: 2 - x }));
    expect(validateBuilding(rotated)).toEqual([]);
    expect(matchConstruction(rotated, target).matches).toBe(false);
    const translated = BUILDINGS[0].blocks.map((block) => ({ ...block, x: block.x + 1 }));
    expect(validateBuilding(translated)).toEqual([]);
    expect(matchConstruction(translated, BUILDINGS[0].blocks).matches).toBe(false);
  });

  it.each([
    [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
    [{ x: 0, y: 1, z: 0 }],
    [{ x: 0, y: 3, z: 0 }],
    [{ x: 3, y: 0, z: 0 }],
    [{ x: 0, y: 0, z: -1 }],
    [{ x: .5, y: 0, z: 0 }],
    [{ x: 0, y: NaN, z: 0 }],
    [{ x: Infinity, y: 0, z: 0 }],
  ])('rejects invalid coordinates, overlaps or missing support', (...blocks: Block[]) => {
    expect(matchConstruction(blocks, blocks).matches).toBe(false);
  });

  it('rejects duplicate source cubes even when its coordinate set equals a valid target', () => {
    const target = BUILDINGS[0].blocks;
    expect(matchConstruction([...target, { ...target[0] }], target)).toEqual({ matches: false, missing: 0, extra: 0 });
  });
});
