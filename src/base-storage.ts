import { BASE_CREATION_IDS, BASE_THEMES, isBaseCreationId, isBasePlacement, type BasePlacements, type BaseTheme } from './geometry/base';

export interface BaseSave { version: 1; theme: BaseTheme; placements: BasePlacements }
export interface BaseSaveOptions { availableIds?: readonly string[]; completedCount?: number }
const KEY = 'katachi-planet:base:v1';
let session: BaseSave | undefined;
const empty = (): BaseSave => ({ version: 1, theme: 'grass', placements: {} });

function sanitize(value: unknown): BaseSave {
  const result = empty();
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return result;
  const fields = value as Record<string, unknown>;
  if (BASE_THEMES.some((theme) => theme.id === fields.theme)) result.theme = fields.theme as BaseTheme;
  if (!fields.placements || typeof fields.placements !== 'object' || Array.isArray(fields.placements)) return result;
  const occupied = new Set<string>();
  for (const [id, placement] of Object.entries(fields.placements)) {
    if (!isBaseCreationId(id) || !isBasePlacement(placement)) continue;
    const key = `${placement.x},${placement.z}`;
    if (occupied.has(key)) continue;
    result.placements[id] = { x: placement.x, z: placement.z, rotation: placement.rotation };
    occupied.add(key);
  }
  return result;
}
function usable(value: BaseSave, options: BaseSaveOptions): BaseSave {
  const result = structuredClone(value);
  const available = new Set(options.availableIds ?? BASE_CREATION_IDS);
  for (const id of BASE_CREATION_IDS) if (!available.has(id)) delete result.placements[id];
  const givenCount = options.completedCount ?? 0;
  const count = Number.isFinite(givenCount) && givenCount >= 0 ? Math.floor(givenCount) : 0;
  if ((BASE_THEMES.find((theme) => theme.id === result.theme)?.needed ?? Infinity) > count) result.theme = 'grass';
  return result;
}
export function readBase(options: BaseSaveOptions = {}): BaseSave {
  if (!session) {
    try {
      const raw = localStorage.getItem(KEY);
      session = raw && raw.length < 30_000 ? sanitize(JSON.parse(raw)) : empty();
    } catch { session = empty(); }
  }
  return usable(session, options);
}
export function saveBase(value: BaseSave, options: BaseSaveOptions = {}): boolean {
  session = usable(sanitize(value), options);
  try { localStorage.setItem(KEY, JSON.stringify(session)); return true; }
  catch { return false; }
}
