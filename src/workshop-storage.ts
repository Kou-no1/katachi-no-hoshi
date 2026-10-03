import { BUILDINGS, validateBuilding, type Block } from './geometry/blocks';
import { CONSTRUCTION_LIMITS, matchConstruction } from './geometry/construction';

export interface WorkshopSave {
  version: 1;
  drafts: Record<string, Block[]>;
  creations: Record<string, Block[]>;
}
const KEY = 'katachi-planet:workshop:v1';
const ids = new Set(['free', ...BUILDINGS.map(building => building.id)]);
let session: WorkshopSave | undefined;
const empty = (): WorkshopSave => ({ version: 1, drafts: {}, creations: {} });
const copy = (value: WorkshopSave): WorkshopSave => structuredClone(value);

function validBlocks(value: unknown, allowEmpty: boolean): value is Block[] {
  if (!Array.isArray(value) || value.length > 27 || (!allowEmpty && !value.length)) return false;
  if (!value.every(block => block && typeof block === 'object' &&
    Number.isInteger(block.x) && block.x >= 0 && block.x < CONSTRUCTION_LIMITS.width &&
    Number.isInteger(block.y) && block.y >= 0 && block.y < CONSTRUCTION_LIMITS.height &&
    Number.isInteger(block.z) && block.z >= 0 && block.z < CONSTRUCTION_LIMITS.depth)) return false;
  return value.length === 0 || validateBuilding(value).length === 0;
}
function sanitize(value: unknown): WorkshopSave {
  const result = empty();
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return result;
  const fields = value as Record<string, unknown>;
  for (const field of ['drafts', 'creations'] as const) {
    const collection = fields[field];
    if (!collection || typeof collection !== 'object') continue;
    for (const [id, blocks] of Object.entries(collection)) {
      if (ids.has(id) && validBlocks(blocks, field === 'drafts')) {
        if (field === 'creations' && id !== 'free' && !matchConstruction(blocks, BUILDINGS.find(b => b.id === id)!.blocks).matches) continue;
        result[field][id] = blocks.map(({ x, y, z }) => ({ x, y, z }));
      }
    }
  }
  return result;
}
export function readWorkshop(): WorkshopSave {
  if (!session) {
    try {
      const raw = localStorage.getItem(KEY);
      session = raw && raw.length < 100_000 ? sanitize(JSON.parse(raw)) : empty();
    } catch { session = empty(); }
  }
  return copy(session);
}
/** Keep playing in this page when persistent storage is unavailable. */
export function saveWorkshop(value: WorkshopSave): boolean {
  session = sanitize(value);
  try { localStorage.setItem(KEY, JSON.stringify(session)); return true; }
  catch { return false; }
}
