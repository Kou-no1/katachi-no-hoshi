import { describe, expect, it } from 'vitest';
import { cubeSection, planeBasis, revolvePoint, revolutionMesh, revolutionProfile, SECTION_PLANES, sectionCoordinates, type Point3 } from './solids';

const keys = (points: readonly Point3[]) => points.map(point => point.map(value => Math.round(value * 1e8) / 1e8).join(',')).sort();
const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((value, index) => value - b[index]));

describe('cube / plane intersections', () => {
  it('cuts x+y+z=2 into the independently known three edge points', () => {
    expect(keys(cubeSection(SECTION_PLANES.triangle))).toEqual(keys([[1, 1, 0], [1, 0, 1], [0, 1, 1]]));
  });
  it('cuts x=z into a rectangle, with sides 2 and 2 sqrt(2)', () => {
    const points = cubeSection(SECTION_PLANES.rectangle);
    expect(keys(points)).toEqual(keys([[-1, -1, -1], [-1, 1, -1], [1, -1, 1], [1, 1, 1]]));
    const lengths = points.map((point, index) => distance(point, points[(index + 1) % points.length])).sort((a, b) => a - b);
    [2, 2, 2 * Math.sqrt(2), 2 * Math.sqrt(2)].forEach((value, index) => expect(lengths[index]).toBeCloseTo(value, 10));
  });
  it('cuts x+y+z=0 into the six permutations of (-1,0,1)', () => {
    const points = cubeSection(SECTION_PLANES.hexagon);
    expect(keys(points)).toEqual(keys([[-1, 0, 1], [-1, 1, 0], [0, -1, 1], [0, 1, -1], [1, -1, 0], [1, 0, -1]]));
    points.forEach((point, index) => expect(distance(point, points[(index + 1) % points.length])).toBeCloseTo(Math.sqrt(2), 10));
  });
  it('handles a coplanar face, tangent edge, tangent vertex, and an outside plane', () => {
    expect(keys(cubeSection({ normal: [1, 0, 0], offset: 1 }))).toEqual(keys([[1, -1, -1], [1, -1, 1], [1, 1, -1], [1, 1, 1]]));
    expect(keys(cubeSection({ normal: [1, 1, 0], offset: 2 }))).toEqual(keys([[1, 1, -1], [1, 1, 1]]));
    expect(keys(cubeSection({ normal: [1, 1, 1], offset: 3 }))).toEqual(keys([[1, 1, 1]]));
    expect(cubeSection({ normal: [1, 0, 0], offset: 2 })).toEqual([]);
  });
  it('is independent of normal scaling and preserves in-plane distances', () => {
    expect(keys(cubeSection({ normal: [7, 7, 7], offset: 14 }))).toEqual(keys(cubeSection(SECTION_PLANES.triangle)));
    const points = cubeSection(SECTION_PLANES.rectangle);
    const flat = sectionCoordinates(points, SECTION_PLANES.rectangle);
    points.forEach((point, index) => expect(distance(point, points[(index + 1) % points.length])).toBeCloseTo(distance(flat[index], flat[(index + 1) % points.length]), 10));
  });
  it('rejects invalid planes and dimensions', () => {
    expect(() => cubeSection({ normal: [0, 0, 0], offset: 0 })).toThrow();
    expect(() => planeBasis({ normal: [1, NaN, 0], offset: 0 })).toThrow();
    expect(() => cubeSection(SECTION_PLANES.triangle, 0)).toThrow();
  });
});

describe('revolution profiles and sweep', () => {
  it('uses a rectangle edge, a triangle leg, and a semicircle diameter as the y-axis', () => {
    expect(revolutionProfile('cylinder')).toEqual([[0, -1], [1, -1], [1, 1], [0, 1]]);
    expect(revolutionProfile('cone')).toEqual([[0, -1], [1, -1], [0, 1]]);
    const halfCircle = revolutionProfile('sphere');
    expect(halfCircle[0]).toEqual([0, -1]);
    expect(halfCircle.at(-1)).toEqual([0, 1]);
    expect(halfCircle[12][0]).toBeCloseTo(1, 10);
    expect(halfCircle[12][1]).toBeCloseTo(0, 10);
    halfCircle.forEach(([radius, y]) => expect(radius * radius + y * y).toBeCloseTo(1, 10));
  });
  it('puts a 90 degree turn on -z and fixes every point on the axis', () => {
    const point = revolvePoint([1, .5], 90);
    [0, .5, -1].forEach((value, index) => expect(point[index]).toBeCloseTo(value, 10));
    expect(revolvePoint([0, -1], 180)).toEqual([0, -1, 0]);
    const full = revolvePoint([1, .5], 360);
    [1, .5, 0].forEach((value, index) => expect(full[index]).toBeCloseTo(value, 10));
  });
  it.each(['cylinder', 'cone', 'sphere'] as const)('builds finite, nondegenerate triangles for %s at zero, partial, and full turn', kind => {
    for (const angle of [0, 90, 180, 360]) {
      const mesh = revolutionMesh(kind, angle);
      expect(mesh.triangles.length).toBeGreaterThan(0);
      mesh.vertices.forEach(point => point.forEach(value => expect(Number.isFinite(value)).toBe(true)));
      mesh.triangles.forEach(triangle => {
        triangle.forEach(index => expect(index >= 0 && index < mesh.vertices.length).toBe(true));
        const [a, b, c] = triangle.map(index => mesh.vertices[index]);
        const ab = b.map((value, index) => value - a[index]); const ac = c.map((value, index) => value - a[index]);
        expect(Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0])).toBeGreaterThan(1e-9);
      });
    }
  });
  it('keeps the spherical swept boundary on the independently known unit sphere', () => {
    revolutionMesh('sphere', 360).vertices.forEach(point => expect(point.reduce((sum, value) => sum + value * value, 0)).toBeCloseTo(1, 10));
  });
  it('rejects invalid sweeps', () => {
    expect(() => revolutionMesh('cylinder', NaN)).toThrow();
    expect(() => revolutionMesh('cone', 361)).toThrow();
    expect(() => revolvePoint([-1, 0], 90)).toThrow();
  });
});
