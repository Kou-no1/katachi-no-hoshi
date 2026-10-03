import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILDINGS, type Block } from './geometry/blocks';
import type { WorkshopSave } from './workshop-storage';

const KEY = 'katachi-planet:workshop:v1';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  forbidGet = false;
  forbidSet = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  getItem(key: string) {
    if (this.forbidGet) throw new Error('Storage access is disabled');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.forbidSet) throw new Error('Storage access is disabled');
    this.values.set(key, String(value));
  }
}

const cloneBlocks = (blocks: readonly Block[]) => blocks.map((block) => ({ ...block }));
const freeCreation = (): Block[] => [{ x: 2, y: 0, z: 2 }, { x: 2, y: 1, z: 2 }, { x: 1, y: 0, z: 2 }];
let storage: MemoryStorage;

beforeEach(() => {
  vi.resetModules();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('workshop save protects children’s drafts and creations', () => {
  it('restores a draft, a solved model and a free creation after reloading, without sharing mutable objects', async () => {
    const { saveWorkshop, readWorkshop } = await import('./workshop-storage');
    const value: WorkshopSave = {
      version: 1,
      drafts: { [BUILDINGS[1].id]: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }] },
      creations: { [BUILDINGS[0].id]: cloneBlocks(BUILDINGS[0].blocks), free: freeCreation() },
    };
    const original = structuredClone(value);
    expect(saveWorkshop(value)).toBe(true);

    value.drafts[BUILDINGS[1].id].pop();
    value.creations.free[0].x = 0;
    const returned = readWorkshop();
    expect(returned).toEqual(original);
    returned.creations[BUILDINGS[0].id][0].y = 2;
    delete returned.drafts[BUILDINGS[1].id];
    expect(readWorkshop()).toEqual(original);

    vi.resetModules();
    const reloaded = await import('./workshop-storage');
    expect(reloaded.readWorkshop()).toEqual(original);
  });

  it('starts safely with malformed JSON, an old version or an excessively large stored payload', async () => {
    const validCreation = { free: freeCreation() };
    const payloads = [
      '{ not valid JSON',
      JSON.stringify({ version: 0, drafts: {}, creations: validCreation }),
      JSON.stringify({ version: 1, drafts: {}, creations: validCreation, padding: 'x'.repeat(100_000) }),
    ];
    for (const raw of payloads) {
      storage.setItem(KEY, raw);
      vi.resetModules();
      const { readWorkshop } = await import('./workshop-storage');
      expect(readWorkshop()).toEqual({ version: 1, drafts: {}, creations: {} });
    }
  });

  it('discards unknown IDs and broken geometry while keeping an independent valid creation', async () => {
    const fullCube = Array.from({ length: 27 }, (_, index) => ({ x: index % 3, y: Math.floor(index / 9), z: Math.floor(index / 3) % 3 }));
    const invalidModels: unknown[] = [
      [{ x: 3, y: 0, z: 0 }],
      [{ x: 0, y: 0, z: -1 }],
      [{ x: 0, y: 0, z: 3 }],
      [0, 1, 2, 3].map((y) => ({ x: 0, y, z: 0 })),
      [{ x: .5, y: 0, z: 0 }],
      [{ x: 0, y: 1, z: 0 }],
      [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
      [...fullCube, { x: 0, y: 0, z: 0 }],
      { x: 0, y: 0, z: 0 },
    ];
    for (const invalid of invalidModels) {
      storage.setItem(KEY, JSON.stringify({
        version: 1,
        drafts: { free: invalid, 'unknown-building': freeCreation() },
        creations: { free: invalid, 'unknown-building': freeCreation(), [BUILDINGS[2].id]: BUILDINGS[2].blocks },
      }));
      vi.resetModules();
      const { readWorkshop } = await import('./workshop-storage');
      expect(readWorkshop()).toEqual({ version: 1, drafts: {}, creations: { [BUILDINGS[2].id]: BUILDINGS[2].blocks } });
    }
  });

  it('keeps an unfinished model as a draft, but never promotes it to a finished creation', async () => {
    const { saveWorkshop, readWorkshop } = await import('./workshop-storage');
    const target = BUILDINGS[1];
    // This missing floor cube has no cube above it. The partial model is legal,
    // but a similar-looking or same-count replacement must not count as solved.
    const partial = target.blocks.filter((block) => !(block.x === 1 && block.y === 0 && block.z === 1));
    const sameCountWrong = [...partial, { x: 2, y: 0, z: 2 }];
    expect(saveWorkshop({
      version: 1,
      drafts: { [target.id]: partial },
      creations: { [target.id]: sameCountWrong, free: freeCreation() },
    })).toBe(true);
    expect(readWorkshop()).toEqual({ version: 1, drafts: { [target.id]: partial }, creations: { free: freeCreation() } });

    vi.resetModules();
    const reloaded = await import('./workshop-storage');
    expect(reloaded.readWorkshop().creations[target.id]).toBeUndefined();
    expect(reloaded.readWorkshop().drafts[target.id]).toEqual(partial);
  });

  it('preserves an intentionally empty draft but excludes empty creations', async () => {
    const { saveWorkshop, readWorkshop } = await import('./workshop-storage');
    saveWorkshop({ version: 1, drafts: { free: [], [BUILDINGS[0].id]: [] }, creations: { free: [], [BUILDINGS[0].id]: [] } });
    vi.resetModules();
    const reloaded = await import('./workshop-storage');
    expect(reloaded.readWorkshop()).toEqual({ version: 1, drafts: { free: [], [BUILDINGS[0].id]: [] }, creations: {} });
    // Reading before a reload also preserves an empty draft as an actual entry.
    expect(readWorkshop().drafts).toHaveProperty('free', []);
  });

  it('keeps usable page state when both reading and writing persistent storage are forbidden', async () => {
    storage.forbidGet = storage.forbidSet = true;
    const { saveWorkshop, readWorkshop } = await import('./workshop-storage');
    expect(readWorkshop()).toEqual({ version: 1, drafts: {}, creations: {} });
    const value: WorkshopSave = { version: 1, drafts: { free: [{ x: 0, y: 0, z: 0 }] }, creations: { free: freeCreation() } };
    expect(saveWorkshop(value)).toBe(false);
    value.creations.free.pop();
    const returned = readWorkshop();
    expect(returned.creations.free).toEqual(freeCreation());
    returned.drafts.free.push({ x: 0, y: 1, z: 0 });
    expect(readWorkshop().drafts.free).toEqual([{ x: 0, y: 0, z: 0 }]);
    expect(storage.length).toBe(0);
    // A new page has no persistent save, even though the previous page kept playing.
    vi.resetModules();
    const reloaded = await import('./workshop-storage');
    expect(reloaded.readWorkshop()).toEqual({ version: 1, drafts: {}, creations: {} });
  });
});
