import type { LabId } from '../types';

export interface LegacyMission { id: string; lab: LabId; skills: string[] }
const entries = (lab: LabId, ids: readonly string[], skills: readonly string[]): LegacyMission[] =>
  ids.map(id => ({ id, lab, skills: [...skills] }));

/**
 * IDs emitted by the six existing labs. Metadata neither migrates their saves nor
 * infers first answers, hints, transfer or mastery from a completed star.
 * Keep this small registry independent of Three.js and browser storage.
 */
export const LEGACY_MISSIONS: readonly LegacyMission[] = [
  ...entries('puzzle', ['puzzle-square'], ['compose']),
  ...entries('puzzle', ['puzzle-turn'], ['rotate']),
  ...entries('blocks', ['blocks-little-house', 'blocks-lookout', 'blocks-space-base'], ['spatial', 'view', 'count']),
  ...entries('blocks', ['blocks-build-little-house', 'blocks-build-lookout', 'blocks-build-space-base'], ['spatial', 'compose']),
  ...entries('transform', ['transform-symmetry-corner', 'transform-symmetry-steps', 'transform-symmetry-zigzag'], ['symmetry']),
  ...entries('transform', ['transform-scale-square', 'transform-scale-triangle', 'transform-scale-half'], ['scale']),
  ...entries('transform', ['transform-area-count', 'transform-area-rectangle', 'transform-area-triangle'], ['area']),
  ...entries('box', ['box-1', 'box-2', 'box-4', 'box-net-long-strip-1', 'box-net-long-strip-2', 'box-net-long-strip-5',
    'box-net-stepped-strip-1', 'box-net-stepped-strip-2', 'box-net-stepped-strip-5'], ['spatial', 'net']),
  ...entries('box', ['box-measure-volume-0', 'box-measure-volume-1', 'box-measure-volume-2'], ['volume']),
  ...entries('box', ['box-measure-surface-0', 'box-measure-surface-1', 'box-measure-surface-2'], ['surface']),
  ...entries('reconstruction', ['reconstruction-corner', 'reconstruction-square', 'reconstruction-stairs'], ['spatial', 'projection']),
  ...entries('solids', ['solids-revolve-cylinder', 'solids-revolve-cone', 'solids-revolve-sphere'], ['spatial', 'revolve']),
  ...entries('solids', ['solids-section-triangle', 'solids-section-rectangle', 'solids-section-hexagon'], ['spatial', 'section']),
];
