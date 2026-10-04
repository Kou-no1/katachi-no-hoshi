import { describe, expect, it } from 'vitest';
import { convexIntersection, polygonArea, transformPolygon } from '../geometry/puzzle';
import { CONTENT_A, evaluateContentA } from './content-a';
import type { ComposeTask, LearningTask, PositionTask, ShapeTask } from './types';

const shapes = CONTENT_A.filter((task): task is ShapeTask => task.kind === 'shape');
const compositions = CONTENT_A.filter((task): task is ComposeTask => task.kind === 'compose');
const positions = CONTENT_A.filter((task): task is PositionTask => task.kind === 'position');

describe('content A curriculum and shape classifications', () => {
  it('contains 36 unique versioned, authored tasks with the intended level distribution', () => {
    expect(CONTENT_A).toHaveLength(36);
    expect(new Set(CONTENT_A.map((task) => task.id)).size).toBe(36);
    for (const unit of ['P01', 'P05', 'P10']) {
      const tasks = CONTENT_A.filter((task) => task.unit === unit);
      expect(tasks).toHaveLength(12);
      expect(tasks.map((task) => task.level)).toEqual([
        'experience', 'experience', 'basic', 'basic', 'basic', 'basic', 'applied', 'applied', 'applied', 'applied', 'transfer', 'transfer',
      ]);
      expect(new Set(tasks.map((task) => task.prompt)).size).toBe(12);
    }
    CONTENT_A.forEach((task) => {
      expect(task.version).toBe(1);
      expect(task.id).toMatch(/^preschool-P(?:01|05|10)-\d{2}$/);
      expect(task.hints).toHaveLength(2);
      [task.title, task.prompt, ...task.hints, task.explanation, task.realActivity, task.observe].forEach((text) => expect(text.trim().length).toBeGreaterThan(5));
    });
  });

  it('accepts every shape fitting the stated feature, regardless of color, scale or orientation', () => {
    const shapeRules = [
      (shape: string) => shape === 'circle', (shape: string) => shape === 'square',
      (shape: string) => shape === 'triangle' || shape === 'right-triangle', (shape: string) => shape === 'rectangle',
      (shape: string) => shape === 'circle', (shape: string) => shape === 'triangle' || shape === 'right-triangle',
      (shape: string) => shape === 'square', (shape: string) => shape === 'l',
      (shape: string) => shape === 'hexagon', (shape: string) => shape === 'square' || shape === 'rectangle',
      (shape: string) => shape === 'circle', (shape: string) => shape === 'square' || shape === 'rectangle',
    ];
    shapes.forEach((task, taskIndex) => {
      const expected = task.options.flatMap((option, index) => shapeRules[taskIndex](option.shape) ? [index] : []);
      expect([...task.answers]).toEqual(expected);
      task.options.forEach((option, index) => expect(evaluateContentA(task, { kind: 'choice', index })).toBe(shapeRules[taskIndex](option.shape)));
    });
    expect(evaluateContentA(shapes[0], { kind: 'choice', index: -1 })).toBe(false);
    expect(evaluateContentA(shapes[0], { kind: 'choice', index: 0.5 })).toBe(false);
    expect(evaluateContentA(shapes[0], { kind: 'choice', index: 4 })).toBe(false);
  });
});

describe('composition geometry', () => {
  it('validates all twelve solutions against independently calculated target areas', () => {
    const expectedAreas = [6, 4, 6, 6, 4, 6, 8, 6, 4, 12, 8, 8];
    compositions.forEach((task, index) => {
      expect(polygonArea(task.target)).toBe(expectedAreas[index]);
      expect(task.pieces.reduce((sum, piece) => sum + polygonArea(piece.points), 0)).toBe(expectedAreas[index]);
      expect(evaluateContentA(task, { kind: 'compose', poses: [...task.solution] })).toBe(true);
      expect(task.pieces.length).toBeGreaterThanOrEqual(2);
      expect(task.pieces.length).toBeLessThanOrEqual(4);
      [task.target, ...task.pieces.map((piece) => piece.points)].flat().forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0); expect(point.x).toBeLessThanOrEqual(6);
        expect(point.y).toBeGreaterThanOrEqual(0); expect(point.y).toBeLessThanOrEqual(6);
      });
    });
  });

  it('keeps initial pieces visible, off the target, and reachable in half-cell and quarter-turn steps', () => {
    compositions.forEach((task) => task.pieces.forEach((piece, index) => {
      const initial = transformPolygon(piece.points, piece.initial);
      initial.forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(-1); expect(point.x).toBeLessThanOrEqual(7);
        expect(point.y).toBeGreaterThanOrEqual(-1); expect(point.y).toBeLessThanOrEqual(7);
      });
      expect(polygonArea(convexIntersection(initial, task.target))).toBeCloseTo(0);
      expect(Number.isInteger((piece.initial.x - task.solution[index].x) * 2)).toBe(true);
      expect(Number.isInteger((piece.initial.y - task.solution[index].y) * 2)).toBe(true);
      expect(Number.isInteger((piece.initial.rotation - task.solution[index].rotation) / 90)).toBe(true);
    }));
  });

  it('uses convex nondegenerate targets and pieces and does not hide initial pieces under one another', () => {
    compositions.forEach((task) => {
      [task.target, ...task.pieces.map((piece) => piece.points)].forEach((points) => {
        const turns = points.map((point, index) => {
          const next = points[(index + 1) % points.length];
          const after = points[(index + 2) % points.length];
          return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x);
        });
        expect(turns.every((turn) => turn > 0) || turns.every((turn) => turn < 0)).toBe(true);
      });
      const initial = task.pieces.map((piece) => transformPolygon(piece.points, piece.initial));
      for (let first = 0; first < initial.length; first += 1) {
        for (let second = first + 1; second < initial.length; second += 1) {
          expect(polygonArea(convexIntersection(initial[first], initial[second]))).toBeCloseTo(0);
        }
      }
    });
  });

  it('accepts the vertical-column alternative to the authored horizontal-strip solution', () => {
    expect(evaluateContentA(compositions[1], { kind: 'compose', poses: [
      { x: 3, y: 0, rotation: 90 }, { x: 4, y: 0, rotation: 90 },
    ] })).toBe(true);
    expect(evaluateContentA(compositions[0], { kind: 'compose', poses: [...compositions[0].solution].reverse() })).toBe(true);
  });

  it('rejects overlap, a gap, outside coverage, missing pieces and non-quarter-turn rotations', () => {
    const task = compositions[0];
    expect(evaluateContentA(task, { kind: 'compose', poses: [task.solution[0], task.solution[0]] })).toBe(false);
    expect(evaluateContentA(task, { kind: 'compose', poses: [task.solution[0], { ...task.solution[1], x: 4.5 }] })).toBe(false);
    expect(evaluateContentA(task, { kind: 'compose', poses: [{ ...task.solution[0], x: 5 }, task.solution[1]] })).toBe(false);
    expect(evaluateContentA(task, { kind: 'compose', poses: [task.solution[0]] })).toBe(false);
    expect(evaluateContentA(task, { kind: 'compose', poses: [{ ...task.solution[0], rotation: 45 }, task.solution[1]] })).toBe(false);
    expect(evaluateContentA(task, { kind: 'compose', poses: [{ ...task.solution[0], x: NaN }, task.solution[1]] })).toBe(false);
  });

  it('requires the four-piece flag to cover its interior as well as its outer corners', () => {
    const task = compositions[11];
    const withOverlap = [...task.solution];
    withOverlap[3] = task.solution[0];
    expect(evaluateContentA(task, { kind: 'compose', poses: withOverlap })).toBe(false);
  });
});

describe('positions with observer-relative left and right', () => {
  const row = (cell: number) => Math.floor(cell / 3);
  const column = (cell: number) => cell % 3;
  // Conditions written independently from each task's declared answer list.
  const rules = [
    (cell: number) => column(cell) > 0 && row(cell) > 0,
    (cell: number) => column(cell) < 2 && row(cell) < 2,
    (cell: number) => column(cell) > 1 && row(cell) < 2,
    (cell: number) => column(cell) < 1 && row(cell) > 0,
    (cell: number) => column(cell) > 0 && row(cell) === 1,
    (cell: number) => row(cell) < 2 && column(cell) === 1,
    (cell: number) => column(cell) < 2 && row(cell) < 2,
    (cell: number) => column(cell) > 0 && row(cell) > 0,
    (cell: number) => column(cell) < 2 && row(cell) === 1,
    (cell: number) => column(cell) > 1 && row(cell) < 2,
    (cell: number) => column(cell) > 0 && row(cell) > 0,
    (cell: number) => column(cell) > 1 && row(cell) < 2,
  ];

  it('lists exactly every empty cell satisfying both instructions in each of the twelve maps', () => {
    positions.forEach((task, index) => {
      expect(new Set(task.anchors.map((anchor) => anchor.cell)).size).toBe(3);
      expect(new Set(task.anchors.map((anchor) => anchor.icon))).toEqual(new Set(['box', 'tree', 'house']));
      const occupied = new Set(task.anchors.map((anchor) => anchor.cell));
      const expected = Array.from({ length: 9 }, (_, cell) => cell).filter((cell) => !occupied.has(cell) && rules[index](cell));
      expect(expected.length).toBeGreaterThan(0);
      expect([...task.answers]).toEqual(expected);
      for (let cell = 0; cell < 9; cell += 1) expect(evaluateContentA(task, { kind: 'position', cell })).toBe(expected.includes(cell));
      expect(task.prompt).toContain(`みるひとは ずの${task.observer === 'bottom' ? 'した' : 'うえ'}`);
      expect(task.prompt).toContain('うえ・したは、ずのうえ・した');
    });
  });

  it('reverses right for the top observer while keeping diagram-up unchanged', () => {
    const task = positions[6];
    expect(task.observer).toBe('top');
    expect(evaluateContentA(task, { kind: 'position', cell: 1 })).toBe(true);
    expect(evaluateContentA(task, { kind: 'position', cell: 2 })).toBe(false);
    expect(evaluateContentA(task, { kind: 'position', cell: 7 })).toBe(false);
    expect(evaluateContentA(task, { kind: 'position', cell: 9 })).toBe(false);
    expect(evaluateContentA(task, { kind: 'position', cell: -1 })).toBe(false);
  });

  it('rejects another answer kind and tasks outside the assigned content kinds', () => {
    expect(evaluateContentA(shapes[0], { kind: 'position', cell: 0 })).toBe(false);
    const other: LearningTask = { ...shapes[0], kind: 'length', unit: 'P14', rods: [{ length: 2, offset: 0, color: '#81b8a2' }], rule: 'longest' };
    expect(evaluateContentA(other, { kind: 'choice', index: 0 })).toBe(false);
  });
});
