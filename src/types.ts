export type LabId = 'puzzle' | 'blocks' | 'box';

export interface GameContext {
  reducedMotion: boolean;
  onComplete: (id: string, label: string) => void;
}

export type MountLab = (container: HTMLElement, context: GameContext) => () => void;
