import {describe,it,expect} from 'vitest';
import {Vector3} from 'three';
import {CUBE_NETS,foldMatrices,facePose,oppositeFace} from './box';
describe('three cube-net topologies',()=>{
  it('uses independent planar coordinates and opposite pairs for the two strip nets',()=>{
    for(const [i,expected] of [[1,[[0,0],[1,0],[2,0],[3,0],[0,1],[2,-1]]],[2,[[0,0],[1,0],[2,0],[3,0],[1,1],[2,-1]]]] as const){
      const faces=CUBE_NETS[i].faces;
      for(const [index,face] of faces.entries()){
        const p=facePose(face.id,0,faces).center;
        expect([p.x,p.y]).toEqual(expected[index]);expect(p.z).toBe(0);
      }
      expect([oppositeFace(1,faces),oppositeFace(2,faces),oppositeFace(5,faces)]).toEqual([3,4,6]);
    }
  });
  it.each(CUBE_NETS)('$name closes into six different axis faces and exactly eight unit cube corners',net=>{
    const vertices=new Set<string>(),normals=new Set<string>();
    for(const face of net.faces){
      const pose=facePose(face.id,1,net.faces);normals.add(pose.normal.toArray().map(n=>Math.round(n)).join(','));
      for(const x of [-.5,.5])for(const y of [-.5,.5]){
        const p=new Vector3(x,y,0).applyMatrix4(pose.matrix);
        expect(Math.abs(p.x)).toBeCloseTo(.5,10);expect(Math.abs(p.y)).toBeCloseTo(.5,10);
        expect(Math.min(Math.abs(p.z),Math.abs(p.z-1))).toBeLessThan(1e-10);
        vertices.add(p.toArray().map(n=>Math.round(n*2)).join(','));
      }
    }
    expect(normals.size).toBe(6);expect(vertices.size).toBe(8);
  });
  it('preserves all shared edges at five independently sampled fold amounts',()=>{
    for(const net of CUBE_NETS)for(const amount of [0,.25,.5,.75,1]){
      const matrices=foldMatrices(amount,net.faces);
      for(const f of net.faces){
        if(f.parent===null)continue;
        for(const t of [-.5,.5]){
          const a=f.hinge==='right'?new Vector3(.5,t,0):f.hinge==='left'?new Vector3(-.5,t,0):f.hinge==='up'?new Vector3(t,.5,0):new Vector3(t,-.5,0);
          const b=f.hinge==='right'?new Vector3(-.5,t,0):f.hinge==='left'?new Vector3(.5,t,0):f.hinge==='up'?new Vector3(t,-.5,0):new Vector3(t,.5,0);
          expect(a.applyMatrix4(matrices.get(f.parent)!).distanceTo(b.applyMatrix4(matrices.get(f.id)!))).toBeLessThan(1e-10);
        }
      }
    }
  });
});
