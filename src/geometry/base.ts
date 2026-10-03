import type { Block } from './blocks';

export const BASE_CREATION_IDS = ['little-house', 'lookout', 'space-base', 'free'] as const;
export type BaseCreationId = typeof BASE_CREATION_IDS[number];
export type BaseTheme = 'grass' | 'blue' | 'sunset';
export type BaseRotation = 0 | 1 | 2 | 3;
export interface BasePlacement { x: number; z: number; rotation: BaseRotation }
export type BasePlacements = Partial<Record<BaseCreationId, BasePlacement>>;
export const BASE_THEMES: readonly { id: BaseTheme; name: string; needed: number; color: string }[] = [
  { id: 'grass', name: '草の星', needed: 0, color: '#e5edd6' },
  { id: 'blue', name: '青の星', needed: 3, color: '#dceef5' },
  { id: 'sunset', name: '夕焼けの星', needed: 12, color: '#f8e2cd' },
];

export function isBaseCreationId(value: string): value is BaseCreationId {
  return (BASE_CREATION_IDS as readonly string[]).includes(value);
}
export function isBasePlacement(value: unknown): value is BasePlacement {
  if (!value || typeof value !== 'object') return false;
  const placement = value as Record<string, unknown>;
  return [placement.x, placement.z].every((coordinate) => typeof coordinate === 'number' && Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 3)
    && typeof placement.rotation === 'number' && Number.isInteger(placement.rotation) && placement.rotation >= 0 && placement.rotation < 4;
}
export function copyBasePlacements(placements: BasePlacements): BasePlacements {
  return Object.fromEntries(Object.entries(placements).map(([id, placement]) => [id, { ...placement }]));
}

/** Clockwise in the top view, about the center of each independent 3 × 3 board. */
export function rotateBaseModel(blocks: readonly Block[], rotation: BaseRotation): Block[] {
  if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) throw new RangeError('Rotation must be 0, 1, 2 or 3 quarter-turns.');
  return blocks.map(({ x, y, z }) => {
    for (let turn = 0; turn < rotation; turn++) [x, z] = [2 - z, x];
    return { x, y, z };
  });
}

export function moveBaseCreation(placements: BasePlacements, id: BaseCreationId, x: number, z: number): {
  placements: BasePlacements; moved: boolean; reason?: 'outside' | 'unknown' | 'occupied' | 'unchanged';
} {
  const copy = copyBasePlacements(placements);
  if (!isBaseCreationId(id)) return { placements: copy, moved: false, reason: 'unknown' };
  if (![x, z].every((coordinate) => Number.isInteger(coordinate) && coordinate >= 0 && coordinate < 3)) return { placements: copy, moved: false, reason: 'outside' };
  if (Object.entries(placements).some(([other, placement]) => other !== id && placement.x === x && placement.z === z)) return { placements: copy, moved: false, reason: 'occupied' };
  if (placements[id]?.x === x && placements[id]?.z === z) return { placements: copy, moved: false, reason: 'unchanged' };
  copy[id] = { x, z, rotation: placements[id]?.rotation ?? 0 };
  return { placements: copy, moved: true };
}
