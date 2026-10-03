import { describe, expect, it } from 'vitest';
import { convexIntersection, evaluatePuzzle, polygonArea, polygonsMatch, PUZZLE_CHALLENGES, transformPolygon } from './puzzle';

describe('puzzle geometry', () => {
  const square = PUZZLE_CHALLENGES[0];
  const turn = PUZZLE_CHALLENGES[1];

  it('preserves exact triangle side lengths and area through a full turn', () => {
    const triangle = square.pieces[0].points;
    const result = transformPolygon(triangle, { x: 40, y: 60, rotation: 90 });
    expect(polygonArea(result)).toBeCloseTo(7200);
    expect(result[0]).toEqual({ x: 100, y: 0 });
    expect(Math.hypot(result[0].x - result[1].x, result[0].y - result[1].y)).toBeCloseTo(120);
    expect(polygonsMatch(transformPolygon(triangle, { x: 0, y: 0, rotation: 360 }), triangle)).toBe(true);
  });

  it('accepts two opposite triangles that tile the square without a gap', () => {
    expect(evaluatePuzzle(square, [
      { x: 460, y: 200, rotation: 0 }, { x: 460, y: 200, rotation: 180 },
    ])).toEqual({ success: true, outsideArea: 0, overlapArea: 0, uncoveredArea: 0 });
  });

  it('also accepts the other diagonal instead of prescribing one answer', () => {
    expect(evaluatePuzzle(square, [
      { x: 460, y: 200, rotation: 90 }, { x: 460, y: 200, rotation: 270 },
    ]).success).toBe(true);
  });

  it('rejects overlapping triangles even when their total area equals the target', () => {
    const evaluation = evaluatePuzzle(square, [
      { x: 460, y: 200, rotation: 0 }, { x: 460, y: 200, rotation: 0 },
    ]);
    expect(evaluation.success).toBe(false);
    expect(evaluation.overlapArea).toBeCloseTo(7200);
    expect(evaluation.uncoveredArea).toBeCloseTo(7200);
  });

  it('rejects a triangle outside the square and reports the uncovered area', () => {
    const evaluation = evaluatePuzzle(square, [
      { x: 460, y: 200, rotation: 0 }, { x: 480, y: 200, rotation: 180 },
    ]);
    expect(evaluation.success).toBe(false);
    expect(evaluation.outsideArea).toBeGreaterThan(0);
    expect(evaluation.uncoveredArea).toBeGreaterThan(0);
  });

  it('handles either polygon winding for a convex intersection', () => {
    const a = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
    const b = [{ x: 10, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 20 }, { x: 10, y: 20 }];
    expect(polygonArea(convexIntersection(a, b))).toBeCloseTo(200);
    expect(polygonArea(convexIntersection(a, [...b].reverse()))).toBeCloseTo(200);
  });

  it('requires the concave L to have the correct orientation as well as position', () => {
    expect(polygonArea(turn.target)).toBeCloseTo(8000);
    expect(evaluatePuzzle(turn, [{ x: 460, y: 200, rotation: 90 }]).success).toBe(true);
    expect(evaluatePuzzle(turn, [{ x: 460, y: 200, rotation: 0 }]).success).toBe(false);
    expect(evaluatePuzzle(turn, [{ x: 480, y: 200, rotation: 90 }]).success).toBe(false);
  });
});
