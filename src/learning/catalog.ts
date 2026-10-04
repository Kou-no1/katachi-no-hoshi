import { CONTENT_A, evaluateContentA } from './content-a';
import { CONTENT_B, evaluateContentB } from './content-b';
import type { Answer, LearningTask, LearningUnit, TaskLevel, UnitId } from './types';

export const LEARNING_UNITS: readonly LearningUnit[] = [
  { id: 'P01', name: 'おなじ かたち', skill: 'identify', caption: 'むきや いろが かわっても？', nextLab: 'puzzle' },
  { id: 'P05', name: 'ピースで つくろう', skill: 'compose', caption: 'あわせて ひとつの かたちに', nextLab: 'puzzle' },
  { id: 'P10', name: 'どうぶつの おうち', skill: 'position', caption: 'どこに おくと いいかな？', nextLab: 'blocks' },
  { id: 'P04', name: 'もようの つづき', skill: 'pattern', caption: 'くりかえす まとまりを みつけよう', nextLab: 'transform' },
  { id: 'P14', name: 'ながさくらべ', skill: 'compare', caption: 'はしを そろえて くらべよう', nextLab: 'transform' },
  { id: 'P17', name: 'まねっこ つみき', skill: 'spatial', caption: 'ばしょと たかさを みよう', nextLab: 'blocks' },
];
export const LEVEL_NAMES: Record<TaskLevel, string> = {
  experience: 'さわってみる', basic: 'ためしてみる', applied: '考えてみる', transfer: 'はじめての図',
};
export const LEARNING_TASKS: readonly LearningTask[] = LEARNING_UNITS.flatMap(unit =>
  [...CONTENT_A, ...CONTENT_B].filter(task => task.unit === unit.id));
export const tasksForUnit = (unit: UnitId) => LEARNING_TASKS.filter(task => task.unit === unit);
export const evaluateLearningTask = (task: LearningTask, answer: Answer): boolean =>
  evaluateContentA(task, answer) || evaluateContentB(task, answer);

/** Snapshot answers before hints or subsequent edits can change the prediction. */
export function copyAnswer(answer: Answer): Answer {
  return JSON.parse(JSON.stringify(answer)) as Answer;
}
