import {describe,it,expect} from 'vitest';
import {cuboidBlocks,exposedFaces,MEASURE_TASKS} from './measure';
import {validateBuilding} from './blocks';
describe('volume and exposed unit faces',()=>{
  it('counts volume and six external faces independently for the three cuboids',()=>{
    expect(MEASURE_TASKS.map(t=>cuboidBlocks(t.width,t.height,t.depth).length)).toEqual([8,6,12]);
    expect(MEASURE_TASKS.map(t=>exposedFaces(cuboidBlocks(t.width,t.height,t.depth)))).toEqual([24,22,32]);
    for(const t of MEASURE_TASKS) expect(validateBuilding(cuboidBlocks(t.width,t.height,t.depth))).toEqual([]);
  });
  it('removes the two shared faces for touching cubes, but keeps separated faces',()=>{
    expect(exposedFaces([{x:0,y:0,z:0}])).toBe(6);
    expect(exposedFaces([{x:0,y:0,z:0},{x:1,y:0,z:0}])).toBe(10);
    expect(exposedFaces([{x:0,y:0,z:0},{x:2,y:0,z:0}])).toBe(12);
    expect(exposedFaces(cuboidBlocks(3,3,3))).toBe(54);
  });
  it('rejects dimensions that cannot be represented on the board',()=>{
    for(const n of [0,-1,4,.5,NaN,Infinity])expect(()=>cuboidBlocks(n,1,1)).toThrow();
  });
});
