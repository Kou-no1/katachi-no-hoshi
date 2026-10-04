import type { Point, PiecePose } from '../geometry/puzzle';
import type { Block, BlockView, ProjectedCell } from '../geometry/blocks';

export type UnitId = 'P01' | 'P05' | 'P10' | 'P04' | 'P14' | 'P17';
export type TaskLevel = 'experience' | 'basic' | 'applied' | 'transfer';
export type Skill = 'identify' | 'compose' | 'position' | 'pattern' | 'compare' | 'spatial';
export interface TaskBase {
  id: string;
  version: 1;
  unit: UnitId;
  level: TaskLevel;
  title: string;
  prompt: string;
  hints: readonly [string, string];
  explanation: string;
  realActivity: string;
  observe: string;
}
export type ShapeKind = 'circle' | 'square' | 'rectangle' | 'triangle' | 'right-triangle' | 'l' | 'hexagon';
export interface ShapeToken { shape: ShapeKind; rotation: number; color: string; scale: number; }
export interface ShapeTask extends TaskBase {
  kind: 'shape'; reference: ShapeToken; options: readonly ShapeToken[]; answers: readonly number[];
}
export interface ComposeTask extends TaskBase {
  kind: 'compose'; target: Point[];
  pieces: readonly { points: Point[]; color: string; initial: PiecePose }[];
  solution: readonly PiecePose[];
}
export interface PositionTask extends TaskBase {
  kind: 'position'; size: 3;
  anchors: readonly { cell: number; icon: 'box' | 'tree' | 'house'; label: string }[];
  observer: 'bottom' | 'top'; answers: readonly number[];
}
export interface PatternTask extends TaskBase {
  kind: 'pattern'; unitPattern: readonly ShapeToken[];
  sequence: readonly (ShapeToken | null)[];
  options: readonly ShapeToken[]; answers: readonly number[];
}
export interface LengthTask extends TaskBase {
  kind: 'length'; rods: readonly { length: number; offset: number; color: string }[];
  rule: 'longest' | 'shortest' | 'equal'; referenceLength?: number; answers: readonly number[];
}
export interface BuildTask extends TaskBase {
  kind: 'build'; target: readonly Block[]; initial: readonly Block[];
  mode: 'copy' | 'projections'; view: BlockView | 'diagonal';
  projections?: Partial<Record<BlockView, readonly ProjectedCell[]>>;
}
export type LearningTask = ShapeTask | ComposeTask | PositionTask | PatternTask | LengthTask | BuildTask;
export interface LearningUnit { id: UnitId; name: string; skill: Skill; caption: string; nextLab: string; }
export type Answer = { kind: 'choice'; index: number } | { kind: 'position'; cell: number }
  | { kind: 'compose'; poses: PiecePose[] } | { kind: 'build'; blocks: Block[] };
