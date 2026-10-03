export type Point3 = readonly [number, number, number];
export type Point2 = readonly [number, number];
export type RevolutionKind = 'cylinder' | 'cone' | 'sphere';
export interface SectionPlane { normal: Point3; offset: number }
export interface SweepMesh { vertices: Point3[]; triangles: [number, number, number][] }

const EPSILON = 1e-9;
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: Point3) => Math.hypot(...a);
const scale = (a: Point3, factor: number): Point3 => [a[0] * factor, a[1] * factor, a[2] * factor];

/** Plane convention: normal dot point = offset. The cube is [-half,half]^3. */
export function planeBasis(plane: SectionPlane): { normal: Point3; origin: Point3; u: Point3; v: Point3 } {
  if (![...plane.normal, plane.offset].every(Number.isFinite)) throw new RangeError('Plane values must be finite.');
  const magnitude = length(plane.normal);
  if (magnitude < EPSILON) throw new RangeError('A plane must have a nonzero normal.');
  const normal = scale(plane.normal, 1 / magnitude);
  const axis: Point3 = Math.abs(normal[0]) <= Math.abs(normal[1]) && Math.abs(normal[0]) <= Math.abs(normal[2]) ? [1, 0, 0]
    : Math.abs(normal[1]) <= Math.abs(normal[2]) ? [0, 1, 0] : [0, 0, 1];
  const rawU = cross(normal, axis);
  const u = scale(rawU, 1 / length(rawU));
  return { normal, origin: scale(normal, plane.offset / magnitude), u, v: cross(normal, u) };
}

export function cubeSection(plane: SectionPlane, half = 1): Point3[] {
  if (!Number.isFinite(half) || half <= 0) throw new RangeError('Cube half-size must be positive and finite.');
  const basis = planeBasis(plane);
  const distance = (point: Point3) => dot(basis.normal, subtract(point, basis.origin));
  const tolerance = EPSILON * Math.max(half, 1);
  const vertices: Point3[] = Array.from({ length: 8 }, (_, index) => [
    index & 4 ? half : -half, index & 2 ? half : -half, index & 1 ? half : -half,
  ]);
  const points: Point3[] = [];
  const add = (point: Point3) => {
    if (!points.some(existing => length(subtract(existing, point)) <= tolerance)) points.push(point);
  };
  // Exactly the twelve cube edges; coplanar edges contribute both endpoints.
  vertices.forEach((start, index) => {
    for (const bit of [1, 2, 4]) {
      if (index & bit) continue;
      const end = vertices[index | bit];
      const a = distance(start); const b = distance(end);
      if (Math.abs(a) <= tolerance) add(start);
      if (Math.abs(b) <= tolerance) add(end);
      if ((a < -tolerance && b > tolerance) || (a > tolerance && b < -tolerance)) {
        const fraction = a / (a - b);
        add([start[0] + fraction * (end[0] - start[0]), start[1] + fraction * (end[1] - start[1]), start[2] + fraction * (end[2] - start[2])]);
      }
    }
  });
  if (points.length < 3) return points;
  const average = (axis: number) => points.reduce((sum, point) => sum + point[axis], 0) / points.length;
  const center: Point3 = [average(0), average(1), average(2)];
  return points.sort((a, b) => {
    const relativeA = subtract(a, center); const relativeB = subtract(b, center);
    return Math.atan2(dot(relativeA, basis.v), dot(relativeA, basis.u)) - Math.atan2(dot(relativeB, basis.v), dot(relativeB, basis.u));
  });
}

/** The coordinates preserve distances: u/v are an orthonormal plane basis. */
export function sectionCoordinates(points: readonly Point3[], plane: SectionPlane): Point2[] {
  const basis = planeBasis(plane);
  return points.map(point => {
    const relative = subtract(point, basis.origin);
    return [dot(relative, basis.u), dot(relative, basis.v)];
  });
}

export const SECTION_PLANES = {
  triangle: { normal: [1, 1, 1], offset: 2 },
  rectangle: { normal: [1, 0, -1], offset: 0 },
  hexagon: { normal: [1, 1, 1], offset: 0 },
} as const satisfies Record<string, SectionPlane>;

/** The filled profile lies in x>=0,z=0. Its y-axis edge is the rotation axis. */
export function revolutionProfile(kind: RevolutionKind): Point2[] {
  if (kind === 'cylinder') return [[0, -1], [1, -1], [1, 1], [0, 1]];
  if (kind === 'cone') return [[0, -1], [1, -1], [0, 1]];
  if (kind !== 'sphere') throw new RangeError('Unknown revolution kind.');
  return Array.from({ length: 25 }, (_, index) => {
    const angle = index * Math.PI / 24;
    return [index === 0 || index === 24 ? 0 : Math.sin(angle), -Math.cos(angle)];
  });
}

export function revolvePoint(point: Point2, angleDegrees: number): Point3 {
  if (![...point, angleDegrees].every(Number.isFinite) || point[0] < 0 || angleDegrees < 0 || angleDegrees > 360) {
    throw new RangeError('A revolution needs a nonnegative radius and an angle from 0 to 360.');
  }
  const angle = angleDegrees * Math.PI / 180;
  if (point[0] === 0) return [0, point[1], 0];
  return [point[0] * Math.cos(angle), point[1], -point[0] * Math.sin(angle)];
}

/** Actual swept boundary, including the two profile caps for a partial turn. */
export function revolutionMesh(kind: RevolutionKind, angleDegrees: number, segments = 48): SweepMesh {
  if (!Number.isFinite(angleDegrees) || angleDegrees < 0 || angleDegrees > 360 || !Number.isInteger(segments) || segments < 3) {
    throw new RangeError('Invalid sweep angle or segment count.');
  }
  const profile = revolutionProfile(kind);
  const steps = angleDegrees === 0 ? 0 : Math.max(1, Math.ceil(segments * angleDegrees / 360));
  const vertices: Point3[] = [];
  for (let ring = 0; ring <= steps; ring++) {
    const angle = steps === 0 ? 0 : angleDegrees * ring / steps;
    vertices.push(...profile.map(point => revolvePoint(point, angle)));
  }
  const triangles: [number, number, number][] = [];
  const add = (a: number, b: number, c: number) => {
    if (length(cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]))) > EPSILON) triangles.push([a, b, c]);
  };
  const count = profile.length;
  for (let ring = 0; ring < steps; ring++) for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    const a = ring * count + index; const b = ring * count + next;
    const c = (ring + 1) * count + index; const d = (ring + 1) * count + next;
    add(a, c, b); add(b, c, d);
  }
  if (angleDegrees < 360) {
    for (let index = 1; index < count - 1; index++) {
      add(0, index, index + 1);
      if (steps > 0) add(steps * count, steps * count + index + 1, steps * count + index);
    }
  }
  return { vertices, triangles };
}
