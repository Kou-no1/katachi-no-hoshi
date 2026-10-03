import { describe, expect, it } from 'vitest';
import { AREA_CHALLENGES, polygonArea, REFLECTION_CHALLENGES, reflectGridCell, reflectPoint, sameCells, samePolygon, scalePolygon, SCALING_CHALLENGES } from './transform';

describe('reflection geometry', () => {
  it('reflects points at equal distance and keeps points on the axis fixed', () => {
    expect(reflectPoint({ x: -3, y: 4 }, 2)).toEqual({ x: 7, y: 4 });
    expect(reflectPoint({ x: 2, y: -5 }, 2)).toEqual({ x: 2, y: -5 });
  });
  it('reflects cell centers without the off-by-one error at an axis between cells', () => {
    expect(reflectGridCell({ column: 0, row: 2 }, 2)).toEqual({ column: 3, row: 2 });
    expect(reflectGridCell({ column: 1, row: 0 }, 2)).toEqual({ column: 2, row: 0 });
    expect(REFLECTION_CHALLENGES[0].source.map((cell) => reflectGridCell(cell, 2))).toEqual([
      { column: 3, row: 0 }, { column: 2, row: 0 }, { column: 2, row: 1 },
    ]);
  });
  it('accepts cell order differences but rejects a missing or extra cell', () => {
    const expected = [{ column: 3, row: 0 }, { column: 2, row: 0 }];
    expect(sameCells(expected, [...expected].reverse())).toBe(true);
    expect(sameCells(expected, expected.slice(1))).toBe(false);
    expect(sameCells(expected, [...expected, { column: 3, row: 1 }])).toBe(false);
  });
});

describe('similarity and area', () => {
  it('scales each displacement from a chosen origin', () => {
    expect(scalePolygon([{ x: 2, y: 3 }, { x: 4, y: 5 }], 2, { x: 1, y: 1 })).toEqual([
      { x: 3, y: 5 }, { x: 7, y: 9 },
    ]);
    expect(() => scalePolygon([{ x: 1, y: 2 }], 0)).toThrow(RangeError);
    expect(() => scalePolygon([{ x: 1, y: 2 }], Infinity)).toThrow(RangeError);
  });
  it('has independently specified target vertices for all scaling tasks', () => {
    const targets = [
      [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }],
      [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 0, y: 6 }],
      [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }],
    ];
    SCALING_CHALLENGES.forEach((challenge, index) => {
      expect(scalePolygon(challenge.source, challenge.targetFactor)).toEqual(targets[index]);
      expect(samePolygon(scalePolygon(challenge.source, 1), targets[index])).toBe(false);
    });
  });
  it('changes a 3-4-5 triangle side by k and its area by k squared', () => {
    const triangle = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }];
    const large = scalePolygon(triangle, 3);
    expect(Math.hypot(large[1].x - large[2].x, large[1].y - large[2].y)).toBe(15);
    expect(polygonArea(triangle)).toBe(6);
    expect(polygonArea(large)).toBe(54);
    expect(polygonArea(scalePolygon(triangle, 0.5))).toBe(1.5);
  });
  it('counts unit squares, rectangle and triangle with independent expected areas', () => {
    expect(AREA_CHALLENGES.map((challenge) => polygonArea(challenge.polygon))).toEqual([6, 12, 6]);
    const reverse = [...AREA_CHALLENGES[2].polygon].reverse();
    expect(polygonArea(reverse)).toBe(6);
  });
  it('compares complete vertices rather than merely matching area', () => {
    const square = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    const rectangle = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 0, y: 1 }];
    expect(polygonArea(square)).toBe(polygonArea(rectangle));
    expect(samePolygon(square, rectangle)).toBe(false);
    expect(samePolygon(square, [...square].reverse())).toBe(true);
  });
});
