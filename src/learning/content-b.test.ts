import { describe, expect, it } from 'vitest';
import { BUILDINGS, projectBlocks, validateBuilding, type Block } from '../geometry/blocks';
import { columnHeight, editColumn, matchConstruction } from '../geometry/construction';
import { CONTENT_B, evaluateContentB } from './content-b';
import type { BuildTask, LengthTask, PatternTask } from './types';

const patterns = CONTENT_B.filter((task): task is PatternTask => task.kind === 'pattern');
const lengths = CONTENT_B.filter((task): task is LengthTask => task.kind === 'length');
const builds = CONTENT_B.filter((task): task is BuildTask => task.kind === 'build');
const expectedPatternChoices = [[1], [0], [2], [0], [1], [1], [2], [2], [0, 2], [1, 2], [0, 3], [1]];
const expectedLengthChoices = [[1], [1], [1], [2], [1], [0], [1], [0], [0, 2], [0, 2], [0, 2], [2, 3]];
// Independent floor-cell heights, in the order of the actual nine edit buttons.
const buildingHeights = [
  [1, 1, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 2, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0, 0], [1, 1, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 3, 0, 0, 0, 0], [1, 1, 0, 1, 1, 0, 0, 0, 0],
  [2, 0, 2, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 1, 3, 0, 0, 0],
  [0, 1, 0, 1, 1, 1, 0, 1, 0], [2, 1, 2, 0, 1, 0, 0, 0, 0],
  [1, 1, 0, 2, 0, 0, 0, 0, 0], [2, 1, 0, 1, 1, 0, 0, 0, 0],
];
function assemble(heights: readonly number[]): Block[] {
  let blocks: Block[] = [];
  heights.forEach((height, cell) => {
    for (let count = 0; count < height; count++) blocks = editColumn(blocks, cell % 3, Math.floor(cell / 3), 'add');
  });
  return blocks;
}

describe('preschool content B authoring', () => {
  it('contains 36 unique versioned tasks with 2 experience, 4 basic, 4 applied and 2 transfer tasks per unit', () => {
    expect(CONTENT_B).toHaveLength(36);
    expect(new Set(CONTENT_B.map((task) => task.id)).size).toBe(36);
    for (const unit of ['P04', 'P14', 'P17']) {
      const tasks = CONTENT_B.filter((task) => task.unit === unit);
      expect(tasks.map((task) => task.level)).toEqual(['experience', 'experience', 'basic', 'basic', 'basic', 'basic', 'applied', 'applied', 'applied', 'applied', 'transfer', 'transfer']);
      tasks.forEach((task, index) => {
        expect(task.id).toBe(`preschool-${unit}-${String(index + 1).padStart(2, '0')}`);
        expect(task.version).toBe(1);
        expect(task.hints).toHaveLength(2);
        for (const text of [task.title, task.prompt, ...task.hints, task.explanation, task.realActivity, task.observe]) {
          expect(text.trim().length).toBeGreaterThan(5);
          expect(/[\p{Script=Han}]/u.test(text)).toBe(false);
        }
      });
    }
  });

  it('has correct reachable answers for every one of the 36 tasks, not merely a stored answer index', () => {
    patterns.forEach((task, i) => {
      expect(task.answers).toEqual(expectedPatternChoices[i]);
      task.options.forEach((_, index) => expect(evaluateContentB(task, { kind: 'choice', index })).toBe(expectedPatternChoices[i].includes(index)));
    });
    lengths.forEach((task, i) => {
      expect(task.answers).toEqual(expectedLengthChoices[i]);
      task.rods.forEach((_, index) => expect(evaluateContentB(task, { kind: 'choice', index })).toBe(expectedLengthChoices[i].includes(index)));
    });
    builds.forEach((task, i) => {
      const built = assemble(buildingHeights[i]);
      expect(evaluateContentB(task, { kind: 'build', blocks: built })).toBe(true);
      expect(matchConstruction(built, task.target).matches).toBe(true);
    });
  });
});

describe('shape-pattern rules', () => {
  it('contains one missing token and a consistent explicit repeat unit, with a single visual answer class', () => {
    for (const task of patterns) {
      const missing = task.sequence.flatMap((item, index) => item === null ? [index] : []);
      expect(missing).toHaveLength(1);
      expect(task.unitPattern.length).toBeGreaterThanOrEqual(2);
      task.sequence.forEach((item, index) => { if (item) expect(item).toEqual(task.unitPattern[index % task.unitPattern.length]); });
      const expected = task.unitPattern[missing[0] % task.unitPattern.length];
      for (const index of task.answers) {
        expect(task.options[index].shape).toBe(expected.shape);
        expect(task.options[index].scale).toBe(expected.scale);
        expect(task.options[index].color).toBe(expected.color);
      }
      expect(new Set(task.options.map((option) => option.color)).size).toBe(1);
    }
  });

  it('treats real rotational symmetries as correct, while distinguishing asymmetric directions and sizes', () => {
    expect(evaluateContentB(patterns[5], { kind: 'choice', index: 1 })).toBe(true); // right triangle 90°
    expect(evaluateContentB(patterns[5], { kind: 'choice', index: 0 })).toBe(false); // right triangle 180°
    expect(evaluateContentB(patterns[7], { kind: 'choice', index: 2 })).toBe(true); // 360° is 0°
    expect(evaluateContentB(patterns[8], { kind: 'choice', index: 0 })).toBe(true); // rectangle 180°
    expect(evaluateContentB(patterns[8], { kind: 'choice', index: 2 })).toBe(true); // rectangle 0°
    expect(evaluateContentB(patterns[8], { kind: 'choice', index: 3 })).toBe(false); // rectangle 90°
    expect(evaluateContentB(patterns[9], { kind: 'choice', index: 1 })).toBe(true); // large square 90°
    expect(evaluateContentB(patterns[9], { kind: 'choice', index: 0 })).toBe(false); // small square
    expect(evaluateContentB(patterns[10], { kind: 'choice', index: 0 })).toBe(true); // hexagon 60°
    expect(evaluateContentB(patterns[10], { kind: 'choice', index: 3 })).toBe(true); // hexagon 0°
  });
});

describe('rod lengths are independent of where the ends are drawn', () => {
  it('chooses by physical length rather than the furthest or nearest right endpoint', () => {
    expect(lengths[6].rods[0].length + lengths[6].rods[0].offset).toBeGreaterThan(lengths[6].rods[1].length + lengths[6].rods[1].offset);
    expect(evaluateContentB(lengths[6], { kind: 'choice', index: 0 })).toBe(false);
    expect(evaluateContentB(lengths[6], { kind: 'choice', index: 1 })).toBe(true);
    expect(lengths[7].rods[0].length + lengths[7].rods[0].offset).toBeGreaterThan(lengths[7].rods[1].length + lengths[7].rods[1].offset);
    expect(evaluateContentB(lengths[7], { kind: 'choice', index: 0 })).toBe(true);
    expect(evaluateContentB(lengths[7], { kind: 'choice', index: 1 })).toBe(false);
  });

  it('accepts every tie for equal, longest and shortest, with valid dimensions and a reference for equality', () => {
    for (const i of [8, 9, 10, 11]) {
      expect(lengths[i].answers.length).toBe(2);
      for (const index of expectedLengthChoices[i]) expect(evaluateContentB(lengths[i], { kind: 'choice', index })).toBe(true);
    }
    for (const task of lengths) {
      if (task.rule === 'equal') expect(task.referenceLength).toBeGreaterThan(0);
      for (const rod of task.rods) {
        expect(Number.isInteger(rod.length)).toBe(true);
        expect(rod.length).toBeGreaterThanOrEqual(1); expect(rod.length).toBeLessThanOrEqual(8);
        expect(Number.isInteger(rod.offset)).toBe(true);
        expect(rod.offset).toBeGreaterThanOrEqual(0); expect(rod.offset).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('preschool block models', () => {
  it('uses supported small models, one-column repairs and new examples before two transfer projection tasks', () => {
    for (const [index, task] of builds.entries()) {
      expect(validateBuilding(task.target)).toEqual([]);
      expect(task.target.length).toBeGreaterThanOrEqual(2); expect(task.target.length).toBeLessThanOrEqual(6);
      if (task.initial.length) expect(validateBuilding(task.initial)).toEqual([]);
      for (const block of [...task.target, ...task.initial]) expect([block.x, block.y, block.z].every((value) => Number.isInteger(value) && value >= 0 && value < 3)).toBe(true);
      expect(BUILDINGS.some((building) => matchConstruction(task.target, building.blocks).matches)).toBe(false);
      expect(task.mode).toBe(index < 10 ? 'copy' : 'projections');
      if (index >= 10) { expect(task.level).toBe('transfer'); expect(Object.keys(task.projections!)).toHaveLength(2); }
    }
    for (const index of [4, 5, 7, 8]) {
      const task = builds[index];
      const changes = Array.from({ length: 9 }, (_, cell) => columnHeight(task.target, cell % 3, Math.floor(cell / 3)) - columnHeight(task.initial, cell % 3, Math.floor(cell / 3))).filter((difference) => difference !== 0);
      expect(changes).toHaveLength(1);
      expect(Math.abs(changes[0])).toBe(1);
      expect(evaluateContentB(task, { kind: 'build', blocks: [...task.initial] })).toBe(false);
    }
  });

  it('accepts a different side view and a different cube count when only front and top are shown', () => {
    const task = builds[10];
    const differentSide = assemble([2, 1, 0, 1, 0, 0, 0, 0, 0]);
    const extraHiddenCube = assemble([2, 1, 0, 2, 0, 0, 0, 0, 0]);
    expect(differentSide).toHaveLength(4); expect(extraHiddenCube).toHaveLength(5);
    expect(projectBlocks(differentSide, 'side')).not.toEqual(projectBlocks(task.target, 'side'));
    expect(matchConstruction(differentSide, task.target).matches).toBe(false);
    expect(evaluateContentB(task, { kind: 'build', blocks: differentSide })).toBe(true);
    expect(evaluateContentB(task, { kind: 'build', blocks: extraHiddenCube })).toBe(true);
  });

  it('accepts a different top view when only front and right side are shown, but rejects unsupported apparent matches', () => {
    const task = builds[11];
    const otherSolution = assemble([2, 0, 0, 0, 1, 0, 0, 0, 0]);
    expect(otherSolution).toHaveLength(3);
    expect(projectBlocks(otherSolution, 'top')).not.toEqual(projectBlocks(task.target, 'top'));
    expect(evaluateContentB(task, { kind: 'build', blocks: otherSolution })).toBe(true);
    const floating = task.target.filter((block) => !(block.x === 0 && block.y === 0 && block.z === 0));
    expect(projectBlocks(floating, 'front')).toEqual(task.projections!.front);
    expect(projectBlocks(floating, 'side')).toEqual(task.projections!.side);
    expect(evaluateContentB(task, { kind: 'build', blocks: floating })).toBe(false);
  });

  it('rejects duplicate, fractional, outside or floating cubes and keeps copy origins fixed', () => {
    for (const task of [builds[0], builds[10], builds[11]]) {
      expect(evaluateContentB(task, { kind: 'build', blocks: [...task.target, { ...task.target[0] }] })).toBe(false);
      for (const block of [{ x: 3, y: 0, z: 0 }, { x: .5, y: 0, z: 0 }, { x: 0, y: 3, z: 0 }, { x: 0, y: 0, z: -1 }]) {
        expect(evaluateContentB(task, { kind: 'build', blocks: [...task.target, block] })).toBe(false);
      }
      expect(evaluateContentB(task, { kind: 'build', blocks: [] })).toBe(false);
    }
    expect(evaluateContentB(builds[0], { kind: 'build', blocks: [{ x: 1, y: 0, z: 1 }, { x: 2, y: 0, z: 1 }] })).toBe(false);
  });
});

it('does not grade unsupported units, incompatible answer types or out-of-range choice indices', () => {
  expect(evaluateContentB({ ...patterns[0], unit: 'P01' }, { kind: 'choice', index: 1 })).toBe(false);
  expect(evaluateContentB(patterns[0], { kind: 'position', cell: 1 })).toBe(false);
  expect(evaluateContentB(lengths[0], { kind: 'build', blocks: [] })).toBe(false);
  expect(evaluateContentB(builds[0], { kind: 'choice', index: 0 })).toBe(false);
  for (const index of [-1, .5, 99, NaN]) expect(evaluateContentB(patterns[0], { kind: 'choice', index })).toBe(false);
});
