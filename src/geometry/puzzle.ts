export interface Point {
  x: number;
  y: number;
}

export interface PiecePose extends Point {
  rotation: number;
}

export interface PuzzlePiece {
  id: string;
  label: string;
  color: string;
  points: Point[];
  initialPose: PiecePose;
}

export interface PuzzleChallenge {
  id: string;
  label: string;
  description: string;
  hint: string;
  target: Point[];
  pieces: PuzzlePiece[];
  mode: 'cover' | 'match';
}

export function rotatePoint(point: Point, degrees: number): Point {
  const radians = degrees * Math.PI / 180;
  // Round harmless floating-point noise, preserving exact grid corners at 90°.
  const cleanTrig = (value: number) => Math.abs(value) < 1e-10 ? 0 : Math.abs(Math.abs(value) - 1) < 1e-10 ? Math.sign(value) : value;
  const cosine = cleanTrig(Math.cos(radians));
  const sine = cleanTrig(Math.sin(radians));
  const x = point.x * cosine - point.y * sine;
  const y = point.x * sine + point.y * cosine;
  return { x: Math.abs(x) < 1e-10 ? 0 : x, y: Math.abs(y) < 1e-10 ? 0 : y };
}

export function transformPolygon(points: Point[], pose: PiecePose): Point[] {
  return points.map((point) => {
    const rotated = rotatePoint(point, pose.rotation);
    return { x: rotated.x + pose.x, y: rotated.y + pose.y };
  });
}

function signedArea(points: Point[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

export function polygonArea(points: Point[]): number {
  return Math.abs(signedArea(points));
}

const cross = (a: Point, b: Point, c: Point): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Clip a polygon against a convex polygon. Used for the triangle/square task. */
export function convexIntersection(subject: Point[], clip: Point[]): Point[] {
  let result = subject.map((point) => ({ ...point }));
  const orientation = signedArea(clip) >= 0 ? 1 : -1;
  for (let edge = 0; edge < clip.length; edge += 1) {
    const a = clip[edge];
    const b = clip[(edge + 1) % clip.length];
    const input = result;
    result = [];
    if (!input.length) break;
    for (let index = 0; index < input.length; index += 1) {
      const start = input[index];
      const end = input[(index + 1) % input.length];
      const startCross = cross(a, b, start) * orientation;
      const endCross = cross(a, b, end) * orientation;
      const startInside = startCross >= -1e-8;
      const endInside = endCross >= -1e-8;
      if (startInside !== endInside) {
        const fraction = startCross / (startCross - endCross);
        result.push({
          x: start.x + fraction * (end.x - start.x),
          y: start.y + fraction * (end.y - start.y),
        });
      }
      if (endInside) result.push(end);
    }
  }
  return result;
}

export function polygonsMatch(a: Point[], b: Point[], tolerance = 0.01): boolean {
  if (a.length !== b.length) return false;
  return b.some((_, start) => [1, -1].some((direction) =>
    a.every((point, index) => {
      const other = b[(start + index * direction + b.length) % b.length];
      return Math.hypot(point.x - other.x, point.y - other.y) <= tolerance;
    }),
  ));
}

export interface PuzzleEvaluation {
  success: boolean;
  outsideArea: number;
  overlapArea: number;
  uncoveredArea: number;
}

export function evaluatePuzzle(challenge: PuzzleChallenge, poses: PiecePose[]): PuzzleEvaluation {
  if (poses.length !== challenge.pieces.length) {
    return { success: false, outsideArea: 0, overlapArea: 0, uncoveredArea: polygonArea(challenge.target) };
  }
  const polygons = challenge.pieces.map((piece, index) => transformPolygon(piece.points, poses[index]));
  if (challenge.mode === 'match') {
    const success = polygons.length === 1 && polygonsMatch(polygons[0], challenge.target);
    return { success, outsideArea: 0, overlapArea: 0, uncoveredArea: success ? 0 : polygonArea(challenge.target) };
  }
  let outsideArea = 0;
  let insideArea = 0;
  let overlapArea = 0;
  polygons.forEach((polygon) => {
    const inside = polygonArea(convexIntersection(polygon, challenge.target));
    insideArea += inside;
    outsideArea += Math.max(0, polygonArea(polygon) - inside);
  });
  // The cover challenge contains two triangles. Their shared edge has zero area.
  for (let first = 0; first < polygons.length; first += 1) {
    for (let second = first + 1; second < polygons.length; second += 1) {
      overlapArea += polygonArea(convexIntersection(polygons[first], polygons[second]));
    }
  }
  const uncoveredArea = Math.max(0, polygonArea(challenge.target) - insideArea + overlapArea);
  return { success: outsideArea < 0.01 && overlapArea < 0.01 && uncoveredArea < 0.01,
    outsideArea, overlapArea, uncoveredArea };
}

const triangle: Point[] = [{ x: -60, y: -60 }, { x: 60, y: -60 }, { x: -60, y: 60 }];
const lShape: Point[] = [
  { x: -60, y: -60 }, { x: -20, y: -60 }, { x: -20, y: 20 },
  { x: 60, y: 20 }, { x: 60, y: 60 }, { x: -60, y: 60 },
];

export const PUZZLE_CHALLENGES: PuzzleChallenge[] = [
  {
    id: 'square', label: 'さんかくで しかく', mode: 'cover',
    description: '２つの三角を動かして、点線の四角をぴったりうめよう。',
    hint: '三角の長い辺どうしを合わせてみよう。片方を２回くるっと回すと？',
    target: [{ x: 400, y: 140 }, { x: 520, y: 140 }, { x: 520, y: 260 }, { x: 400, y: 260 }],
    pieces: [
      { id: 'coral-triangle', label: '１', color: '#f19b79', points: triangle, initialPose: { x: 120, y: 140, rotation: 0 } },
      { id: 'mint-triangle', label: '２', color: '#81b8a2', points: triangle, initialPose: { x: 220, y: 300, rotation: 0 } },
    ],
  },
  {
    id: 'turn', label: 'くるっと あわせよう', mode: 'match',
    description: 'ピースを回して、点線と同じ向きにしてから運ぼう。',
    hint: '先に「くるっと」を１回押して、長い部分がどこへ動くか見てみよう。',
    target: transformPolygon(lShape, { x: 460, y: 200, rotation: 90 }),
    pieces: [{ id: 'l-piece', label: '１', color: '#f19b79', points: lShape, initialPose: { x: 160, y: 200, rotation: 0 } }],
  },
];
