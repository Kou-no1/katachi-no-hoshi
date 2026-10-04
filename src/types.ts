export type LabId = 'preschool' | 'puzzle' | 'blocks' | 'box' | 'transform' | 'reconstruction' | 'solids';

export interface GameContext {
  reducedMotion: boolean;
  onComplete: (id: string, label: string) => void;
  onNarrate?: (text: string) => void;
  onRead?: (text: string) => void;
  getCompleted?: () => Record<string,string>;
}

export type MountLab = (container: HTMLElement, context: GameContext) => () => void;
