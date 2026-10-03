import { describe, expect, it } from 'vitest';
import { BUILDINGS, validateBuilding } from './blocks';
import { moveBaseCreation, rotateBaseModel, type BasePlacements } from './base';

describe('independent building boards on the base', () => {
  it('rotates each model without changing cube count, support or the 3 × 3 bounds', () => {
    for (const building of BUILDINGS) for (const turn of [0, 1, 2, 3] as const) {
      const rotated = rotateBaseModel(building.blocks, turn);
      expect(rotated).toHaveLength(building.blocks.length);
      expect(validateBuilding(rotated)).toEqual([]);
      expect(rotated.every(({ x, z }) => x >= 0 && x < 3 && z >= 0 && z < 3)).toBe(true);
      expect(new Set(rotated.map(({ x, y, z }) => `${x},${y},${z}`)).size).toBe(rotated.length);
    }
    expect(rotateBaseModel([{ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }], 1)).toEqual([{ x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }]);
    const original = BUILDINGS[0].blocks;
    expect(rotateBaseModel(rotateBaseModel(original, 1), 3)).toEqual(original);
  });

  it('rejects a move into an occupied tile without swapping either creation', () => {
    const placements: BasePlacements = { 'little-house': { x: 0, z: 0, rotation: 1 }, free: { x: 1, z: 2, rotation: 3 } };
    const collision = moveBaseCreation(placements, 'little-house', 1, 2);
    expect(collision.moved).toBe(false);
    expect(collision.reason).toBe('occupied');
    expect(collision.placements).toEqual(placements);
    const moved = moveBaseCreation(placements, 'little-house', 2, 2);
    expect(moved.moved).toBe(true);
    expect(moved.placements['little-house']).toEqual({ x: 2, z: 2, rotation: 1 });
    expect(placements['little-house']).toEqual({ x: 0, z: 0, rotation: 1 });
    moved.placements.free!.x = 0;
    expect(placements.free!.x).toBe(1);
    for (const [x, z] of [[3, 0], [0, -1], [.5, 0]]) expect(moveBaseCreation(placements, 'free', x, z).reason).toBe('outside');
  });
});
