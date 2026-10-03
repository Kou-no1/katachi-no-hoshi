import { describe, expect, it } from 'vitest';
import { BUILDINGS, blocksInLayer, countBlocks, projectBlocks, validateBuilding } from './blocks';

describe('building data and projections', () => {
  it('has 4, 6 and 8 unique blocks, each supported from the floor', () => {
    expect(BUILDINGS.map(({ blocks }) => countBlocks(blocks))).toEqual([4, 6, 8]);
    for (const { blocks } of BUILDINGS) expect(validateBuilding(blocks)).toEqual([]);
  });

  it('projects the first building from front, right side and above', () => {
    const blocks = BUILDINGS[0].blocks;
    expect(projectBlocks(blocks, 'front')).toEqual([
      { u: 0, v: 0 }, { u: 1, v: 0 }, { u: 0, v: 1 },
    ]);
    expect(projectBlocks(blocks, 'side')).toEqual([
      { u: -1, v: 0 }, { u: 0, v: 0 }, { u: 0, v: 1 },
    ]);
    expect(projectBlocks(blocks, 'top')).toEqual([
      { u: 0, v: -1 }, { u: 0, v: 0 }, { u: 1, v: 0 },
    ]);
  });

  it('deduplicates cells along a viewing ray but keeps hidden cubes in the count', () => {
    const blocks = BUILDINGS[1].blocks;
    expect(projectBlocks(blocks, 'front')).toHaveLength(4);
    expect(projectBlocks(blocks, 'side')).toHaveLength(3);
    expect(projectBlocks(blocks, 'top')).toHaveLength(4);
    expect(countBlocks(blocks)).toBe(6);
    expect(blocksInLayer(blocks, 0)).toHaveLength(4);
    expect(blocksInLayer(blocks, 1)).toHaveLength(2);
  });

  it('preserves view handedness for an asymmetric staircase', () => {
    const blocks = [
      { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 },
    ];
    expect(projectBlocks(blocks, 'side')).toEqual([
      { u: -1, v: 0 }, { u: 0, v: 0 }, { u: -1, v: 1 },
    ]);
    expect(projectBlocks(blocks, 'top')).toEqual([{ u: 0, v: -1 }, { u: 0, v: 0 }]);
  });

  it('rejects overlaps, unsupported cubes and invalid coordinates', () => {
    expect(validateBuilding([{ x: 0, y: 1, z: 0 }])).toContain('An upper block has no supporting block.');
    expect(validateBuilding([{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }])).toContain('Blocks overlap.');
    expect(validateBuilding([{ x: -1, y: 0, z: 0 }])).toContain('Coordinates must be nonnegative integers.');
    expect(validateBuilding([{ x: 0.5, y: 0, z: 0 }])).toContain('Coordinates must be nonnegative integers.');
    expect(validateBuilding([])).toContain('The building is empty.');
  });
});
