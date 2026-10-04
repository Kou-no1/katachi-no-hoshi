import { describe, expect, it, vi } from 'vitest';
import { LEGACY_MISSIONS } from './legacy';
import { LEARNING_LABS } from '../curriculum';
import { PUZZLE_CHALLENGES } from '../geometry/puzzle';
import { BUILDINGS } from '../geometry/blocks';
import { CUBE_NETS } from '../geometry/box';
import { REFLECTION_CHALLENGES, SCALING_CHALLENGES, AREA_CHALLENGES } from '../geometry/transform';
import { MEASURE_TASKS } from '../geometry/measure';
import { RECONSTRUCTION_TASKS } from '../geometry/reconstruction';
import { SECTION_PLANES } from '../geometry/solids';

describe('existing mission metadata', () => {
  it('matches all IDs emitted by the current lab data, including the original box ID format', () => {
    const expected = [
      ...PUZZLE_CHALLENGES.map(task => `puzzle-${task.id}`),
      ...BUILDINGS.flatMap(building => [`blocks-${building.id}`, `blocks-build-${building.id}`]),
      ...REFLECTION_CHALLENGES.map(task => `transform-symmetry-${task.id}`),
      ...SCALING_CHALLENGES.map(task => `transform-scale-${task.id}`),
      ...AREA_CHALLENGES.map(task => `transform-area-${task.id}`),
      ...CUBE_NETS.flatMap((net, index) => (index === 0 ? [1, 2, 4] : [1, 2, 5])
        .map(face => index === 0 ? `box-${face}` : `box-net-${net.id}-${face}`)),
      ...MEASURE_TASKS.flatMap((_, index) => [`box-measure-volume-${index}`, `box-measure-surface-${index}`]),
      ...RECONSTRUCTION_TASKS.map(task => `reconstruction-${task.id}`),
      ...['cylinder', 'cone', 'sphere'].map(kind => `solids-revolve-${kind}`),
      ...Object.keys(SECTION_PLANES).map(kind => `solids-section-${kind}`),
    ];
    expect(LEGACY_MISSIONS.map(mission => mission.id).sort()).toEqual(expected.sort());
    expect(new Set(LEGACY_MISSIONS.map(mission => mission.id)).size).toBe(41);
  });

  it('preserves each existing lab count and attaches skills rather than inferred learning evidence', () => {
    for (const lab of LEARNING_LABS.filter(lab => lab.id !== 'preschool')) {
      const missions = LEGACY_MISSIONS.filter(mission => mission.lab === lab.id);
      expect(missions).toHaveLength(lab.goal);
      expect(missions.every(mission => mission.skills.length > 0 && mission.id.startsWith(`${lab.id}-`))).toBe(true);
    }
    expect(LEGACY_MISSIONS.every(mission => Object.keys(mission).sort().join(',') === 'id,lab,skills')).toBe(true);
  });

  it('does not access or modify existing saved progress when importing metadata', async () => {
    vi.resetModules();
    const getItem = vi.fn(() => { throw new Error('Metadata must not read storage'); });
    const setItem = vi.fn(() => { throw new Error('Metadata must not write storage'); });
    vi.stubGlobal('localStorage', { getItem, setItem });
    try {
      const metadata = await import('./legacy');
      expect(metadata.LEGACY_MISSIONS).toHaveLength(41);
      expect(getItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
