import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseSave } from './base-storage';

const KEY = 'katachi-planet:base:v1';
class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  forbidGet = false;
  forbidSet = false;
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  clear() { this.values.clear(); }
  removeItem(key: string) { this.values.delete(key); }
  getItem(key: string) {
    if (this.forbidGet) throw new Error('Reading storage is disabled');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.forbidSet) throw new Error('Writing storage is disabled');
    this.values.set(key, value);
  }
}
let storage: MemoryStorage;
beforeEach(() => {
  vi.resetModules();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

describe('base layout saves', () => {
  it('round-trips independent placements and keeps both input and returned references separate', async () => {
    const { saveBase, readBase } = await import('./base-storage');
    const sourceKey = 'katachi-planet:workshop:v1';
    storage.setItem(sourceKey, 'source-creations-must-stay-intact');
    const save: BaseSave = { version: 1, theme: 'blue', placements: {
      'little-house': { x: 0, z: 2, rotation: 1 },
      free: { x: 2, z: 0, rotation: 3 },
    } };
    expect(saveBase(save, { completedCount: 3 })).toBe(true);
    save.placements.free!.x = 0;
    save.theme = 'grass';
    const copy = readBase({ completedCount: 3 });
    expect(copy).toEqual({ version: 1, theme: 'blue', placements: {
      'little-house': { x: 0, z: 2, rotation: 1 }, free: { x: 2, z: 0, rotation: 3 },
    } });
    copy.placements['little-house']!.z = 0;
    delete copy.placements.free;
    expect(readBase({ completedCount: 3 }).placements).toEqual({
      'little-house': { x: 0, z: 2, rotation: 1 }, free: { x: 2, z: 0, rotation: 3 },
    });
    expect(storage.getItem(sourceKey)).toBe('source-creations-must-stay-intact');
    vi.resetModules();
    const reloaded = await import('./base-storage');
    expect(reloaded.readBase({ completedCount: 3 })).toEqual({ version: 1, theme: 'blue', placements: {
      'little-house': { x: 0, z: 2, rotation: 1 }, free: { x: 2, z: 0, rotation: 3 },
    } });
  });

  it('recovers from broken JSON, unsupported versions and an oversized payload with an empty base', async () => {
    for (const raw of [
      '{ broken JSON',
      'null',
      JSON.stringify({ version: 0, theme: 'blue', placements: { free: { x: 0, z: 0, rotation: 0 } } }),
      JSON.stringify({ version: 2, theme: 'sunset', placements: { free: { x: 1, z: 1, rotation: 0 } } }),
      JSON.stringify({ version: 1, theme: 'blue', placements: {}, padding: 'x'.repeat(30_000) }),
    ]) {
      storage.setItem(KEY, raw); vi.resetModules();
      const { readBase } = await import('./base-storage');
      expect(readBase({ completedCount: 12 })).toEqual({ version: 1, theme: 'grass', placements: {} });
    }
  });

  it('ignores invalid or unknown placements and rejects two creations occupying the same tile', async () => {
    const valid = { x: 2, z: 1, rotation: 2 };
    for (const invalid of [
      { x: -1, z: 0, rotation: 0 }, { x: 3, z: 0, rotation: 0 },
      { x: 0, z: 3, rotation: 0 }, { x: .5, z: 0, rotation: 0 },
      { x: 0, z: 0, rotation: 4 }, { x: 0, z: 0, rotation: .5 },
      { x: '0', z: 0, rotation: 0 }, null,
    ]) {
      storage.setItem(KEY, JSON.stringify({ version: 1, theme: 'grass', placements: {
        free: valid, 'little-house': invalid, 'unknown-building': { x: 1, z: 2, rotation: 1 },
      } }));
      vi.resetModules();
      const { readBase } = await import('./base-storage');
      expect(readBase()).toEqual({ version: 1, theme: 'grass', placements: { free: { x: 2, z: 1, rotation: 2 } } });
    }
    storage.setItem(KEY, JSON.stringify({ version: 1, theme: 'grass', placements: {
      lookout: { x: 1, z: 1, rotation: 1 },
      free: { x: 1, z: 1, rotation: 3 },
      'space-base': { x: 2, z: 2, rotation: 0 },
    } }));
    vi.resetModules();
    const { readBase } = await import('./base-storage');
    expect(readBase().placements).toEqual({ lookout: { x: 1, z: 1, rotation: 1 }, 'space-base': { x: 2, z: 2, rotation: 0 } });
  });

  it('enforces the exact 3 and 12 star thresholds when reading or saving a theme', async () => {
    const { saveBase, readBase } = await import('./base-storage');
    expect(saveBase({ version: 1, theme: 'blue', placements: {} }, { completedCount: 3 })).toBe(true);
    expect(readBase({ completedCount: 2 }).theme).toBe('grass');
    expect(readBase({ completedCount: 3 }).theme).toBe('blue');
    saveBase({ version: 1, theme: 'sunset', placements: {} }, { completedCount: 12 });
    expect(readBase({ completedCount: 11 }).theme).toBe('grass');
    expect(readBase({ completedCount: 12 }).theme).toBe('sunset');
    expect(readBase({ completedCount: NaN }).theme).toBe('grass');
    saveBase({ version: 1, theme: 'sunset', placements: {} }, { completedCount: 3 });
    vi.resetModules();
    const reloaded = await import('./base-storage');
    expect(reloaded.readBase({ completedCount: 12 }).theme).toBe('grass');
    storage.setItem(KEY, JSON.stringify({ version: 1, theme: 'unknown-planet', placements: {} }));
    vi.resetModules();
    const unknown = await import('./base-storage');
    expect(unknown.readBase({ completedCount: 99 }).theme).toBe('grass');
  });

  it('only exposes available creations without mutating the saved layout, and filters unavailable IDs on save', async () => {
    storage.setItem(KEY, JSON.stringify({ version: 1, theme: 'grass', placements: {
      'little-house': { x: 0, z: 0, rotation: 0 },
      lookout: { x: 1, z: 0, rotation: 1 },
      'space-base': { x: 2, z: 0, rotation: 2 },
      free: { x: 1, z: 2, rotation: 3 },
    } }));
    const { readBase, saveBase } = await import('./base-storage');
    const onlyFree = readBase({ availableIds: ['free', 'unknown-building'] });
    expect(onlyFree.placements).toEqual({ free: { x: 1, z: 2, rotation: 3 } });
    onlyFree.placements.free!.rotation = 0;
    expect(readBase({ availableIds: ['free'] }).placements.free!.rotation).toBe(3);
    expect(readBase({ availableIds: [] }).placements).toEqual({});
    expect(readBase().placements).toEqual({
      'little-house': { x: 0, z: 0, rotation: 0 }, lookout: { x: 1, z: 0, rotation: 1 },
      'space-base': { x: 2, z: 0, rotation: 2 }, free: { x: 1, z: 2, rotation: 3 },
    });
    saveBase(readBase(), { availableIds: ['free'] });
    vi.resetModules();
    const reloaded = await import('./base-storage');
    expect(reloaded.readBase().placements).toEqual({ free: { x: 1, z: 2, rotation: 3 } });
  });

  it('keeps new page state when writes fail, even if later reads are also forbidden', async () => {
    storage.setItem(KEY, JSON.stringify({ version: 1, theme: 'grass', placements: { free: { x: 0, z: 0, rotation: 0 } } }));
    const { readBase, saveBase } = await import('./base-storage');
    expect(readBase().placements.free).toEqual({ x: 0, z: 0, rotation: 0 });
    storage.forbidSet = true;
    const value: BaseSave = { version: 1, theme: 'blue', placements: { free: { x: 2, z: 2, rotation: 1 } } };
    expect(saveBase(value, { completedCount: 3 })).toBe(false);
    value.placements.free!.x = 0;
    storage.forbidGet = true;
    const cached = readBase({ completedCount: 3 });
    expect(cached).toEqual({ version: 1, theme: 'blue', placements: { free: { x: 2, z: 2, rotation: 1 } } });
    cached.placements.free!.rotation = 3;
    expect(readBase({ completedCount: 3 }).placements.free!.rotation).toBe(1);
    vi.resetModules();
    const reloaded = await import('./base-storage');
    expect(reloaded.readBase({ completedCount: 3 })).toEqual({ version: 1, theme: 'grass', placements: {} });
  });
});
