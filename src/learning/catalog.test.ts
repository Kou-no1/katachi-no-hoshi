import { describe, expect, it } from 'vitest';
import { LEARNING_TASKS, LEARNING_UNITS, tasksForUnit } from './catalog';
import { LEARNING_LABS, labCompletedCount } from '../curriculum';
import { LEGACY_MISSIONS } from './legacy';

describe('curriculum and reward compatibility',()=>{
  it('offers 72 stable distinct activities in six complete learning sequences',()=>{
    expect(LEARNING_TASKS).toHaveLength(72);
    expect(new Set(LEARNING_TASKS.map(t=>t.id)).size).toBe(72);
    for(const unit of LEARNING_UNITS){
      const tasks=tasksForUnit(unit.id);
      expect(tasks.map(t=>t.level)).toEqual(['experience','experience',...Array(4).fill('basic'),...Array(4).fill('applied'),'transfer','transfer']);
      tasks.forEach((task,i)=>expect(task.id).toBe(`preschool-${unit.id}-${String(i+1).padStart(2,'0')}`));
    }
    expect(LEARNING_TASKS.some(t=>LEGACY_MISSIONS.some(m=>m.id===t.id))).toBe(false);
  });
  it('keeps the original 41 rewards and counts every catalog goal correctly',()=>{
    const completed=Object.fromEntries([...LEGACY_MISSIONS.map(m=>m.id),...LEARNING_TASKS.map(t=>t.id)].map(id=>[id,'test']));
    expect(LEGACY_MISSIONS).toHaveLength(41);
    for(const lab of LEARNING_LABS)expect(labCompletedCount(lab.id,completed)).toBe(lab.goal);
    expect(LEARNING_LABS.reduce((sum,lab)=>sum+lab.goal,0)).toBe(113);
  });
  it('does not inflate lab completion with stale or malformed identifiers',()=>{
    expect(labCompletedCount('preschool',{'preschool-P01-01':'done','preschool-P01-99':'stale'})).toBe(1);
    expect(labCompletedCount('box',{'box-1':'done','box-999':'stale'})).toBe(1);
  });
});
