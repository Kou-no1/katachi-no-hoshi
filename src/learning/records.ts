import type { Answer, LearningTask, TaskLevel, UnitId } from './types';

export interface LearningAttempt {
  attemptId: string;
  taskId: string;
  taskVersion: 1;
  level: TaskLevel;
  firstAnswer: Answer;
  checks: number;
  hintLevel: 0 | 1 | 2;
  supportUsed: boolean;
  correct: boolean;
  at: number;
  /** Internal first-check timestamp; omitted by callers and older version-1 saves. */
  firstAt?: number;
}
export interface LearningRecords { version: 1; attempts: LearningAttempt[] }
export interface UnitSummary {
  /** Completion is an activity count, including experiences, rather than mastery. */
  completed: number;
  /** Successful non-experience tasks with a hint or observation support. */
  supported: number;
  /** Transfer tasks correct on the first check without hints or support. */
  independentTransfer: number;
  lastAt?: number;
}

const KEY = 'katachi-planet:learning:v1';
const MAX_ATTEMPTS = 500;
const MAX_RAW_LENGTH = 2_000_000;
const LEVELS: readonly TaskLevel[] = ['experience', 'basic', 'applied', 'transfer'];
let session: LearningRecords | undefined;
let needsPersistence = false;
const empty = (): LearningRecords => ({ version: 1, attempts: [] });
const copy = (value: LearningRecords): LearningRecords => structuredClone(value);
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && value.trim().length > 0;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const coordinate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000;

function answer(value: unknown): Answer | undefined {
  if (!object(value)) return;
  if (value.kind === 'choice' && integer(value.index, 0, 255)) return { kind: 'choice', index: value.index };
  if (value.kind === 'position' && integer(value.cell, 0, 255)) return { kind: 'position', cell: value.cell };
  if (value.kind === 'compose' && Array.isArray(value.poses) && value.poses.length <= 32) {
    if (!value.poses.every(pose => object(pose) && coordinate(pose.x) && coordinate(pose.y) && coordinate(pose.rotation))) return;
    return { kind: 'compose', poses: value.poses.map(pose => ({ x: pose.x, y: pose.y, rotation: pose.rotation })) };
  }
  if (value.kind === 'build' && Array.isArray(value.blocks) && value.blocks.length <= 216) {
    // A first answer can be wrong or empty; this validates its representation, not its correctness.
    if (!value.blocks.every(block => object(block) && integer(block.x, 0, 20) && integer(block.y, 0, 20) && integer(block.z, 0, 20))) return;
    return { kind: 'build', blocks: value.blocks.map(block => ({ x: block.x, y: block.y, z: block.z })) };
  }
}

function attempt(value: unknown): LearningAttempt | undefined {
  if (!object(value) || !validId(value.attemptId) || !validId(value.taskId) || value.taskVersion !== 1
    || !LEVELS.includes(value.level as TaskLevel) || !integer(value.checks, 1, 10_000)
    || !integer(value.hintLevel, 0, 2) || typeof value.supportUsed !== 'boolean'
    || typeof value.correct !== 'boolean' || !integer(value.at, 0, Number.MAX_SAFE_INTEGER)
    || (value.firstAt !== undefined && !integer(value.firstAt, 0, value.at))) return;
  const firstAnswer = answer(value.firstAnswer);
  if (!firstAnswer) return;
  return {
    attemptId: value.attemptId, taskId: value.taskId, taskVersion: 1,
    level: value.level as TaskLevel, firstAnswer, checks: value.checks,
    hintLevel: value.hintLevel as 0 | 1 | 2, supportUsed: value.supportUsed,
    correct: value.correct, at: value.at, firstAt: value.firstAt as number | undefined ?? value.at,
  };
}

function firstTransferAttempts(attempts: readonly LearningAttempt[]): LearningAttempt[] {
  const first = new Map<string, LearningAttempt>();
  for (const record of attempts) {
    if (record.level !== 'transfer') continue;
    const key = JSON.stringify([record.taskId, record.taskVersion]);
    const previous = first.get(key);
    if (!previous || (record.firstAt ?? record.at) < (previous.firstAt ?? previous.at)) first.set(key, record);
  }
  return [...first.values()];
}

function sanitize(value: unknown): LearningRecords | undefined {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.attempts) || value.attempts.length > 10_000) return;
  const unique = new Map<string, LearningAttempt>();
  for (const candidate of value.attempts) {
    const valid = attempt(candidate);
    if (valid) {
      const previous = unique.get(valid.attemptId);
      if (previous && previous.taskId === valid.taskId && previous.taskVersion === valid.taskVersion)
        valid.firstAt = Math.min(previous.firstAt ?? previous.at, valid.firstAt ?? valid.at);
      // A close/save update of the same episode must replace its earlier snapshot.
      unique.delete(valid.attemptId);
      unique.set(valid.attemptId, valid);
    }
  }
  if (value.attempts.length > 0 && unique.size === 0) return;
  const chronological = [...unique.values()].sort((a, b) => a.at - b.at);
  // Keep the first transfer episode even after many later retries. Losing it
  // would turn a previously encountered diagram into a false first success.
  const pinned = firstTransferAttempts(chronological)
    .sort((a, b) => (a.firstAt ?? a.at) - (b.firstAt ?? b.at)).slice(0, MAX_ATTEMPTS);
  const pinnedIds = new Set(pinned.map(record => record.attemptId));
  const capacity = MAX_ATTEMPTS - pinned.length;
  const recent = capacity > 0 ? chronological.filter(record => !pinnedIds.has(record.attemptId)).slice(-capacity) : [];
  return { version: 1, attempts: [...pinned, ...recent].sort((a, b) => a.at - b.at) };
}

/** Read only the independent learning key. A failed write remains usable in this page. */
export function readLearningRecords(): LearningRecords {
  if (needsPersistence && session) return copy(session);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) session = empty();
    else if (raw.length <= MAX_RAW_LENGTH) session = sanitize(JSON.parse(raw)) ?? session ?? empty();
    else session ??= empty();
  } catch { session ??= empty(); }
  return copy(session ?? empty());
}

export function saveLearningRecords(records: LearningRecords): boolean {
  const clean = sanitize(records);
  if (!clean) return false;
  session = clean;
  try {
    const serialized = JSON.stringify(clean);
    if (serialized.length > MAX_RAW_LENGTH) { needsPersistence = true; return false; }
    localStorage.setItem(KEY, serialized);
    needsPersistence = false;
    return true;
  } catch { needsPersistence = true; return false; }
}

/** Pure immutable insertion/update. Repeating a task creates an episode with a new ID. */
export function addAttempt(records: LearningRecords, value: LearningAttempt): LearningRecords {
  const clean = sanitize(records) ?? empty();
  const next = attempt(value);
  if (!next) return clean;
  const previous = clean.attempts.find(item => item.attemptId === next.attemptId);
  if (previous && previous.taskId === next.taskId && previous.taskVersion === next.taskVersion)
    next.firstAt = Math.min(previous.firstAt ?? previous.at, next.firstAt ?? next.at);
  return sanitize({ version: 1, attempts: [...clean.attempts.filter(item => item.attemptId !== next.attemptId), next] })!;
}

export function resetLearningRecords(): boolean {
  return saveLearningRecords(empty());
}

function matchingAttempts(records: LearningRecords, tasks: readonly LearningTask[], unit: UnitId): LearningAttempt[] {
  const catalog = new Map(tasks.filter(task => task.unit === unit).map(task => [task.id, task]));
  return (sanitize(records) ?? empty()).attempts.filter(record => {
    const task = catalog.get(record.taskId);
    if (!task || task.version !== record.taskVersion || task.level !== record.level) return false;
    const expectedKind = task.kind === 'shape' || task.kind === 'pattern' || task.kind === 'length' ? 'choice' : task.kind;
    return record.firstAnswer.kind === expectedKind;
  });
}

export function deriveUnitSummary(records: LearningRecords, tasks: readonly LearningTask[], unit: UnitId): UnitSummary {
  const attempts = matchingAttempts(records, tasks, unit);
  const completed = new Set(attempts.filter(item => item.correct).map(item => item.taskId));
  const supported = new Set(attempts.filter(item => item.correct && item.level !== 'experience'
    && (item.hintLevel > 0 || item.supportUsed)).map(item => item.taskId));
  const independentTransfer = new Set(firstTransferAttempts(attempts).filter(item => item.correct
    && item.checks === 1 && item.hintLevel === 0 && !item.supportUsed).map(item => item.taskId));
  return {
    completed: completed.size, supported: supported.size, independentTransfer: independentTransfer.size,
    ...(attempts.length ? { lastAt: attempts[attempts.length - 1].at } : {}),
  };
}

/** Recommend a learning step; a completion record is never a claim of mastery. */
export function recommendTask(tasks: readonly LearningTask[], records: LearningRecords, unit: UnitId): LearningTask | undefined {
  const catalog = tasks.filter(task => task.unit === unit);
  const attempts = matchingAttempts(records, catalog, unit);
  const completed = new Set(attempts.filter(item => item.correct).map(item => item.taskId));
  let lastTransferIndex = -1;
  attempts.forEach((item, index) => { if (item.level === 'transfer') lastTransferIndex = index; });
  if (lastTransferIndex >= 0 && !attempts[lastTransferIndex].correct
    && !attempts.slice(lastTransferIndex + 1).some(item => item.level === 'basic' && item.correct)) {
    const basics = catalog.filter(task => task.level === 'basic');
    const recovery = basics.find(task => !completed.has(task.id)) ?? basics[0];
    if (recovery) return recovery;
  }
  for (const level of LEVELS) {
    const next = catalog.find(task => task.level === level && !completed.has(task.id));
    if (next) return next;
  }
}
