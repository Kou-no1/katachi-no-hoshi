export interface Point { x: number; y: number }
export interface GridCell { column: number; row: number }
export type TransformMode = 'symmetry' | 'scale' | 'area';

export function reflectPoint(point: Point, axisX: number): Point {
  return { x: 2 * axisX - point.x, y: point.y };
}

/** A grid cell is reflected through its center, not its left edge. */
export function reflectGridCell(cell: GridCell, axisColumn: number): GridCell {
  const center = reflectPoint({ x: cell.column + 0.5, y: cell.row + 0.5 }, axisColumn);
  return { column: center.x - 0.5, row: center.y - 0.5 };
}

export function scalePolygon(points: Point[], factor: number, origin: Point = { x: 0, y: 0 }): Point[] {
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('Scale must be finite and positive.');
  return points.map((point) => ({ x: origin.x + (point.x - origin.x) * factor, y: origin.y + (point.y - origin.y) * factor }));
}

export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

export function samePolygon(a: Point[], b: Point[], tolerance = 1e-7): boolean {
  if (a.length !== b.length) return false;
  return b.some((_, offset) => [1, -1].some((direction) => a.every((point, index) => {
    const other = b[(offset + index * direction + b.length) % b.length];
    return Math.hypot(point.x - other.x, point.y - other.y) < tolerance;
  })));
}

export const cellKey = (cell: GridCell): string => `${cell.column},${cell.row}`;

export function sameCells(a: GridCell[], b: GridCell[]): boolean {
  const first = new Set(a.map(cellKey));
  const second = new Set(b.map(cellKey));
  return first.size === second.size && [...first].every((key) => second.has(key));
}

interface ChallengeText { id: string; label: string; description: string; hint: string }
export interface ReflectionChallenge extends ChallengeText { source: GridCell[] }
export interface ScalingChallenge extends ChallengeText { source: Point[]; targetFactor: number; options: number[] }
export interface AreaChallenge extends ChallengeText { polygon: Point[]; kind: 'count' | 'rectangle' | 'triangle' }

export const REFLECTION_CHALLENGES: ReflectionChallenge[] = [
  {
    id: 'corner', label: '鏡のむこうの形',
    description: 'まんなかの線を鏡にして、左の形と向かい合う形を右に作ろう。右のマスを押すと色が変わるよ。',
    hint: '線に近いマスは右でも線に近いよ。上と下の場所は変わらないよ。',
    source: [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 1, row: 1 }],
  },
  {
    id: 'steps', label: '階段をうつそう',
    description: '左の階段を、鏡のむこうに作ろう。線から同じだけ離れたマスを探してみよう。',
    hint: '１行ずつ見よう。線から１マス、２マスの順に見くらべるとわかりやすいよ。',
    source: [{ column: 0, row: 1 }, { column: 0, row: 2 }, { column: 1, row: 2 }, { column: 1, row: 3 }],
  },
  {
    id: 'zigzag', label: 'すきまも鏡にうつる？',
    description: '色のある場所も、ない場所も見くらべて、右の形を完成させよう。',
    hint: '鏡にうつると左右が入れかわるよ。空いているマスも同じようにうつるね。',
    source: [{ column: 0, row: 0 }, { column: 1, row: 1 }, { column: 0, row: 2 }, { column: 1, row: 2 }, { column: 1, row: 3 }],
  },
];

export const SCALING_CHALLENGES: ScalingChallenge[] = [
  {
    id: 'square', label: '大きな正方形',
    description: 'もとの形を、点線の見本と同じ大きさにしよう。何倍にすると合うかな？ 予想してからボタンを選ぼう。',
    hint: '横の長さをマスで数えてみよう。縦も同じ倍になるか、たしかめよう。',
    source: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }], targetFactor: 2, options: [1, 2, 3],
  },
  {
    id: 'triangle', label: '三角形を大きく',
    description: '点線の三角形を目ざそう。横だけでなく、高さも同じ倍に変えよう。',
    hint: 'もとの横の長さが、点線の横にいくつ入るか考えてみよう。',
    source: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 2 }], targetFactor: 3, options: [1, 2, 3],
  },
  {
    id: 'half', label: '小さな長方形',
    description: '今度は点線の見本まで小さくしよう。形はそのまま、縦も横も同じ倍に変えるよ。',
    hint: '大きくするボタンばかりかな？ １より小さい数のボタンも探してみよう。',
    source: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }], targetFactor: 0.5, options: [0.5, 1, 1.5],
  },
];

export const AREA_CHALLENGES: AreaChallenge[] = [
  {
    id: 'count', label: 'マスを数えよう', kind: 'count',
    description: '１マスは1 cm²。色のついた形は何マス分かな？ 面積を数字で答えよう。',
    hint: '１行のマスを数えてから、何行あるか見てみよう。１マスは1 cm²だよ。',
    polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 2 }, { x: 0, y: 2 }],
  },
  {
    id: 'rectangle', label: '長方形の面積', kind: 'rectangle',
    description: '横と縦の長さから、長方形の面積を考えよう。マスを見てたしかめることもできるよ。',
    hint: '１行に何マス入りそう？ その行がいくつあるか考えてみよう。',
    polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
  },
  {
    id: 'triangle', label: '三角形の面積', kind: 'triangle',
    description: '横4 cm、高さ3 cmの三角形。面積は何 cm²かな？ 四角と比べて予想してみよう。',
    hint: '同じ三角形をもう１つ合わせると、どんな四角になるかな？',
    polygon: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }],
  },
];
