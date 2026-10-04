import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LearningAttempt, LearningRecords } from './records';
import type { LearningTask, ShapeTask, TaskLevel } from './types';

const KEY = 'katachi-planet:learning:v1';
const OLD_KEYS = ['katachi-planet:prototype:v1', 'katachi-planet:workshop:v1', 'katachi-planet:base:v1'];
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  forbidGet = false;
  forbidSet = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  clear() { this.values.clear(); }
  removeItem(key: string) { this.values.delete(key); }
  getItem(key: string) { if (this.forbidGet) throw new Error('Reading disabled'); return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.forbidSet) throw new Error('Writing disabled'); this.values.set(key, value); }
}
let storage: MemoryStorage;
beforeEach(() => {
  vi.resetModules();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const blank = (): LearningRecords => ({ version: 1, attempts: [] });
function task(id: string, level: TaskLevel): ShapeTask {
  return {
    id, version: 1, unit: 'P01', level, title: id, prompt: '', hints: ['', ''],
    explanation: '', realActivity: '', observe: '', kind: 'shape',
    reference: { shape: 'square', rotation: 0, color: '#000', scale: 1 },
    options: [{ shape: 'square', rotation: 0, color: '#000', scale: 1 }], answers: [0],
  };
}
const tasks: LearningTask[] = [task('experience', 'experience'), task('basic', 'basic'),
  task('applied', 'applied'), task('transfer', 'transfer'), task('transfer-two', 'transfer')];
function episode(taskId = 'basic', changes: Partial<LearningAttempt> = {}): LearningAttempt {
  const value: LearningAttempt = {
    attemptId: 'episode-1', taskId, taskVersion: 1,
    level: tasks.find(item => item.id === taskId)?.level ?? 'basic',
    firstAnswer: { kind: 'choice', index: 0 }, checks: 1, hintLevel: 0,
    supportUsed: false, correct: true, at: 100, ...changes,
  };
  return { ...value, firstAt: changes.firstAt ?? value.at };
}

describe('independent learning record storage', () => {
  it('round-trips snapshots, strips unrelated fields and preserves all previous save keys', async () => {
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    OLD_KEYS.forEach((key, index) => storage.setItem(key, `existing-save-${index}`));
    const records = { version: 1 as const, attempts: [episode('basic', {
      firstAnswer: { kind: 'compose', poses: [{ x: 10, y: 20, rotation: 90 }] },
    })] };
    expect(saveLearningRecords(records)).toBe(true);
    records.attempts[0].firstAnswer = { kind: 'choice', index: 3 };
    const restored = readLearningRecords();
    expect(restored.attempts[0].firstAnswer).toEqual({ kind: 'compose', poses: [{ x: 10, y: 20, rotation: 90 }] });
    restored.attempts[0].checks = 99;
    expect(readLearningRecords().attempts[0].checks).toBe(1);
    OLD_KEYS.forEach((key, index) => expect(storage.getItem(key)).toBe(`existing-save-${index}`));
  });

  it('does not infer attempts or understanding from an old completed mission', async () => {
    storage.setItem(OLD_KEYS[0], JSON.stringify({ version: 1, completed: { 'puzzle-square': 'できた' } }));
    const { readLearningRecords, deriveUnitSummary } = await import('./records');
    expect(readLearningRecords()).toEqual(blank());
    expect(deriveUnitSummary(readLearningRecords(), tasks, 'P01')).toEqual({ completed: 0, supported: 0, independentTransfer: 0 });
  });

  it.each(['{broken', JSON.stringify({ version: 2, attempts: [episode()] }), ' '.repeat(2_000_001)])(
    'falls back safely for malformed, unknown-version or excessive serialized records', async raw => {
      storage.setItem(KEY, raw);
      const { readLearningRecords } = await import('./records');
      expect(readLearningRecords()).toEqual(blank());
      expect(storage.getItem(KEY)).toBe(raw);
    });

  it('retains valid entries when another entry is corrupt and validates the full answer representation', async () => {
    storage.setItem(KEY, JSON.stringify({ version: 1, attempts: [episode(),
      episode('basic', { attemptId: 'bad-version', taskVersion: 2 as 1 }),
      episode('basic', { attemptId: 'bad-number', checks: -1 }),
      episode('basic', { attemptId: 'bad-hint', hintLevel: 3 as 2 }),
      episode('basic', { attemptId: 'bad-answer', firstAnswer: { kind: 'compose', poses: [{ x: null as unknown as number, y: 2, rotation: 90 }] } }),
    ] }));
    const { readLearningRecords } = await import('./records');
    expect(readLearningRecords().attempts).toEqual([episode()]);
  });

  it('updates an episode without double-counting but preserves a later repeat as a separate episode', async () => {
    const { addAttempt } = await import('./records');
    const first = addAttempt(blank(), episode('basic', { correct: false }));
    const updated = addAttempt(first, episode('basic', { correct: true, checks: 3, at: 200 }));
    expect(first.attempts[0].correct).toBe(false);
    expect(updated.attempts).toEqual([episode('basic', { correct: true, checks: 3, at: 200, firstAt: 100 })]);
    const repeat = addAttempt(updated, episode('basic', { attemptId: 'episode-2', at: 300 }));
    expect(repeat.attempts).toHaveLength(2);
  });

  it('clones first answers deeply on insertion', async () => {
    const { addAttempt } = await import('./records');
    const attempt = episode('basic', { firstAnswer: { kind: 'build', blocks: [{ x: 0, y: 0, z: 0 }] } });
    const records = addAttempt(blank(), attempt);
    if (attempt.firstAnswer.kind === 'build') attempt.firstAnswer.blocks[0].x = 2;
    expect(records.attempts[0].firstAnswer).toEqual({ kind: 'build', blocks: [{ x: 0, y: 0, z: 0 }] });
  });

  it('keeps the 500 newest timestamps, including after a same-ID update', async () => {
    const { saveLearningRecords, readLearningRecords, addAttempt } = await import('./records');
    const source: LearningRecords = { version: 1, attempts: Array.from({ length: 510 }, (_, index) =>
      episode('basic', { attemptId: `episode-${index}`, at: 510 - index })) };
    expect(saveLearningRecords(source)).toBe(true);
    const saved = readLearningRecords();
    expect(saved.attempts).toHaveLength(500);
    expect(saved.attempts[0].at).toBe(11);
    expect(saved.attempts[499].at).toBe(510);
    const updated = addAttempt(saved, episode('basic', { attemptId: 'episode-499', at: 999 }));
    expect(updated.attempts).toHaveLength(500);
    expect(updated.attempts.at(-1)?.at).toBe(999);
  });

  it('keeps page memory when reads or writes fail and can persist it after storage recovers', async () => {
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    storage.forbidGet = true;
    expect(readLearningRecords()).toEqual(blank());
    storage.forbidSet = true;
    expect(saveLearningRecords({ version: 1, attempts: [episode()] })).toBe(false);
    expect(readLearningRecords().attempts).toEqual([episode()]);
    storage.forbidGet = false;
    expect(readLearningRecords().attempts).toEqual([episode()]);
    storage.forbidSet = false;
    expect(saveLearningRecords(readLearningRecords())).toBe(true);
    expect(JSON.parse(storage.getItem(KEY)!).attempts).toEqual([episode()]);
  });

  it('keeps usable memory if persistent content is later corrupted and rejects an unsupported save version', async () => {
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    expect(saveLearningRecords({ version: 1, attempts: [episode()] })).toBe(true);
    storage.setItem(KEY, '{broken');
    expect(readLearningRecords().attempts).toEqual([episode()]);
    expect(saveLearningRecords({ version: 2, attempts: [] } as unknown as LearningRecords)).toBe(false);
    expect(readLearningRecords().attempts).toEqual([episode()]);
  });

  it('uses the last valid memory when every entry in a stored envelope is corrupted', async () => {
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    saveLearningRecords({ version: 1, attempts: [episode()] });
    storage.setItem(KEY, JSON.stringify({ version: 1, attempts: [{ attemptId: 'broken' }] }));
    expect(readLearningRecords().attempts).toEqual([episode()]);
  });

  it('resets only learning records even when storage is unavailable', async () => {
    const { saveLearningRecords, readLearningRecords, resetLearningRecords } = await import('./records');
    OLD_KEYS.forEach(key => storage.setItem(key, 'preserved'));
    saveLearningRecords({ version: 1, attempts: [episode()] });
    storage.forbidSet = true;
    expect(resetLearningRecords()).toBe(false);
    expect(readLearningRecords()).toEqual(blank());
    OLD_KEYS.forEach(key => expect(storage.getItem(key)).toBe('preserved'));
  });

  it('also works when the global localStorage property itself is unavailable', async () => {
    vi.stubGlobal('localStorage', undefined);
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    expect(readLearningRecords()).toEqual(blank());
    expect(saveLearningRecords({ version: 1, attempts: [episode()] })).toBe(false);
    expect(readLearningRecords().attempts).toEqual([episode()]);
  });
});

describe('evidence summaries and next steps', () => {
  it('counts unique completion and separates supported work from first-check transfer', async () => {
    const { deriveUnitSummary } = await import('./records');
    const records: LearningRecords = { version: 1, attempts: [
      episode('experience', { attemptId: 'a', hintLevel: 2, supportUsed: true, at: 1 }),
      episode('basic', { attemptId: 'b', hintLevel: 1, at: 2 }),
      episode('basic', { attemptId: 'c', at: 3 }),
      episode('transfer', { attemptId: 'd', at: 4 }),
      episode('transfer', { attemptId: 'e', at: 5 }),
      episode('transfer-two', { attemptId: 'f', checks: 3, at: 6 }),
    ] };
    expect(deriveUnitSummary(records, tasks, 'P01')).toEqual({ completed: 4, supported: 1, independentTransfer: 1, lastAt: 6 });
  });

  it('requires no hints, no observation support and one check for independent transfer', async () => {
    const { deriveUnitSummary } = await import('./records');
    for (const changes of [{ hintLevel: 1 as const }, { supportUsed: true }, { checks: 2 }, { correct: false }]) {
      const records: LearningRecords = { version: 1, attempts: [episode('transfer', changes)] };
      expect(deriveUnitSummary(records, tasks, 'P01').independentTransfer).toBe(0);
    }
  });

  it('never treats a correct retry episode as first-check transfer after an initial wrong answer', async () => {
    const { addAttempt, deriveUnitSummary } = await import('./records');
    let records = addAttempt(blank(), episode('transfer', { attemptId: 'first', correct: false, at: 10 }));
    records = addAttempt(records, episode('transfer', { attemptId: 'retry', correct: true, at: 20 }));
    expect(deriveUnitSummary(records, tasks, 'P01')).toEqual({ completed: 1, supported: 0, independentTransfer: 0, lastAt: 20 });
  });

  it('does not replace a supported first transfer with a later unsupported success', async () => {
    const { addAttempt, deriveUnitSummary } = await import('./records');
    let records = addAttempt(blank(), episode('transfer', { attemptId: 'first', hintLevel: 1, supportUsed: true, at: 10 }));
    records = addAttempt(records, episode('transfer', { attemptId: 'retry', at: 20 }));
    expect(deriveUnitSummary(records, tasks, 'P01')).toEqual({ completed: 1, supported: 1, independentTransfer: 0, lastAt: 20 });
  });

  it('preserves first-check ordering when the same episode is updated later with multiple checks', async () => {
    const { addAttempt, deriveUnitSummary } = await import('./records');
    let records = addAttempt(blank(), episode('transfer', { attemptId: 'first', correct: false, at: 10 }));
    records = addAttempt(records, episode('transfer', { attemptId: 'retry', at: 20 }));
    records = addAttempt(records, episode('transfer', { attemptId: 'first', correct: true, checks: 2, at: 30 }));
    expect(records.attempts.find(item => item.attemptId === 'first')?.firstAt).toBe(10);
    expect(deriveUnitSummary(records, tasks, 'P01').independentTransfer).toBe(0);
  });

  it('keeps the first transfer episode and fills the remaining 499 slots with recent attempts', async () => {
    const { saveLearningRecords, readLearningRecords, deriveUnitSummary } = await import('./records');
    const records: LearningRecords = { version: 1, attempts: [
      episode('transfer', { attemptId: 'first', correct: false, at: 1 }),
      ...Array.from({ length: 600 }, (_, index) => episode('basic', { attemptId: `practice-${index}`, at: index + 10 })),
      episode('transfer', { attemptId: 'retry', correct: true, at: 1_000 }),
    ] };
    expect(saveLearningRecords(records)).toBe(true);
    const restored = readLearningRecords();
    expect(restored.attempts).toHaveLength(500);
    expect(restored.attempts.some(item => item.attemptId === 'first')).toBe(true);
    expect(restored.attempts.some(item => item.attemptId === 'practice-101')).toBe(false);
    expect(restored.attempts.some(item => item.attemptId === 'practice-102')).toBe(true);
    expect(restored.attempts.at(-1)?.attemptId).toBe('retry');
    expect(deriveUnitSummary(restored, tasks, 'P01').independentTransfer).toBe(0);
  });

  it('reads earlier version-1 snapshots without a firstAt field and keeps their first evidence', async () => {
    const first = episode('transfer', { attemptId: 'first', correct: false, at: 10 });
    const retry = episode('transfer', { attemptId: 'retry', at: 20 });
    delete first.firstAt;
    delete retry.firstAt;
    storage.setItem(KEY, JSON.stringify({ version: 1, attempts: [first, retry] }));
    const { readLearningRecords, deriveUnitSummary } = await import('./records');
    const restored = readLearningRecords();
    expect(restored.attempts[0].firstAt).toBe(10);
    expect(deriveUnitSummary(restored, tasks, 'P01').independentTransfer).toBe(0);
  });

  it('never exceeds the limit when transfer evidence occupies every available slot', async () => {
    const { saveLearningRecords, readLearningRecords } = await import('./records');
    const records: LearningRecords = { version: 1, attempts: [
      ...Array.from({ length: 501 }, (_, index) => episode(`future-transfer-${index}`, {
        attemptId: `first-${index}`, level: 'transfer', at: index + 1,
      })),
      episode('basic', { attemptId: 'latest-basic', at: 1_000 }),
    ] };
    expect(saveLearningRecords(records)).toBe(true);
    expect(readLearningRecords().attempts).toHaveLength(500);
    expect(readLearningRecords().attempts.every(item => item.level === 'transfer')).toBe(true);
  });

  it('ignores unknown IDs, another unit, a changed version, changed level and incompatible answers', async () => {
    const { deriveUnitSummary, recommendTask } = await import('./records');
    const changedCatalog = tasks.map(item => item.id === 'basic' ? { ...item, version: 2 as 1 } : item);
    const records: LearningRecords = { version: 1, attempts: [
      episode('not-a-task', { attemptId: 'a' }),
      episode('basic', { attemptId: 'b' }),
      episode('transfer', { attemptId: 'c', level: 'basic' }),
      episode('applied', { attemptId: 'd', firstAnswer: { kind: 'position', cell: 1 } }),
    ] };
    expect(deriveUnitSummary(records, changedCatalog, 'P01')).toEqual({ completed: 0, supported: 0, independentTransfer: 0 });
    expect(deriveUnitSummary(records, tasks, 'P17').completed).toBe(0);
    expect(recommendTask(changedCatalog, records, 'P01')?.id).toBe('experience');
  });

  it('starts with experience and then recommends unfinished basic, applied and transfer tasks', async () => {
    const { addAttempt, recommendTask } = await import('./records');
    let records = blank();
    for (const id of ['experience', 'basic', 'applied', 'transfer', 'transfer-two']) {
      expect(recommendTask(tasks, records, 'P01')?.id).toBe(id);
      records = addAttempt(records, episode(id, { attemptId: id, at: records.attempts.length + 1 }));
    }
    expect(recommendTask(tasks, records, 'P01')).toBeUndefined();
  });

  it('returns to a completed basic after failed transfer and retries transfer after successful recovery', async () => {
    const { addAttempt, recommendTask } = await import('./records');
    let records = blank();
    for (const [index, id] of ['experience', 'basic', 'applied'].entries())
      records = addAttempt(records, episode(id, { attemptId: id, at: index + 1 }));
    records = addAttempt(records, episode('transfer', { attemptId: 'failed', correct: false, at: 10 }));
    expect(recommendTask(tasks, records, 'P01')?.id).toBe('basic');
    records = addAttempt(records, episode('basic', { attemptId: 'recovery-wrong', correct: false, at: 11 }));
    expect(recommendTask(tasks, records, 'P01')?.id).toBe('basic');
    records = addAttempt(records, episode('basic', { attemptId: 'recovery', correct: true, hintLevel: 1, at: 12 }));
    expect(recommendTask(tasks, records, 'P01')?.id).toBe('transfer');
  });

  it('does not return to basics due to an old failed transfer followed by a successful transfer', async () => {
    const { recommendTask } = await import('./records');
    const records: LearningRecords = { version: 1, attempts: [
      ...['experience', 'basic', 'applied'].map((id, index) => episode(id, { attemptId: id, at: index + 1 })),
      episode('transfer', { attemptId: 'failed', correct: false, at: 10 }),
      episode('transfer', { attemptId: 'later-correct', correct: true, at: 11 }),
    ] };
    expect(recommendTask(tasks, records, 'P01')?.id).toBe('transfer-two');
  });
});
