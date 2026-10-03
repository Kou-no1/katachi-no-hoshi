export interface Progress { version: 1; completed: Record<string, string>; }
const KEY = 'katachi-planet:prototype:v1';
export function readProgress(): Progress {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (value && typeof value === 'object' && 'version' in value && value.version === 1 && 'completed' in value && value.completed && typeof value.completed === 'object') {
      return { version: 1, completed: Object.fromEntries(Object.entries(value.completed).filter(([key, label]) => key.length < 100 && typeof label === 'string' && label.length < 100)) };
    }
  } catch { /* Storage can be disabled, or an old save can be malformed. */ }
  return { version: 1, completed: {} };
}
export function saveProgress(progress: Progress): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); return true; } catch { return false; }
}
