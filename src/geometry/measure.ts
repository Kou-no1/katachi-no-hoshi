import type { Block } from './blocks';
export function cuboidBlocks(width: number, height: number, depth: number): Block[] {
  if (![width,height,depth].every(n=>Number.isInteger(n)&&n>=1&&n<=3)) throw new RangeError('Dimensions must be integers from 1 to 3.');
  return Array.from({length:width*height*depth},(_,i)=>({x:i%width,y:Math.floor(i/(width*depth)),z:Math.floor(i/width)%depth}));
}
export function exposedFaces(blocks: readonly Block[]): number {
  const cells = new Set(blocks.map(b=>`${b.x},${b.y},${b.z}`));
  return [...cells].reduce((sum,key)=>{
    const [x,y,z]=key.split(',').map(Number);
    return sum+[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].filter(([dx,dy,dz])=>!cells.has(`${x+dx},${y+dy},${z+dz}`)).length;
  },0);
}
export const MEASURE_TASKS = [
  { name:'おなじ長さのはこ', width:2,height:2,depth:2 },
  { name:'ひらたいはこ', width:3,height:1,depth:2 },
  { name:'おおきなはこ', width:3,height:2,depth:2 },
] as const;
