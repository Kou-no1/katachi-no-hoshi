import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { BOX_FACES, facePose, foldMatrices, oppositeFace } from './box';

describe('verified cube net', () => {
  it('opens into the cross net without scaling its faces', () => {
    const expected = [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 2, 0]];
    BOX_FACES.forEach((face, index) => {
      expect(facePose(face.id, 0).center.toArray()).toEqual(expected[index]);
      expect(facePose(face.id, 0).normal.toArray()).toEqual([0, 0, 1]);
    });
  });
  it('closes into exactly six distinct faces of a unit cube', () => {
    const expected = [[0,0,0], [.5,0,.5], [-.5,0,.5], [0,.5,.5], [0,-.5,.5], [0,0,1]];
    BOX_FACES.forEach((face,index) => facePose(face.id,1).center.toArray().forEach((value,axis) => expect(value).toBeCloseTo(expected[index][axis], 10)));
    const vertices = new Set<string>();
    for (const matrix of foldMatrices(1).values()) {
      for (const x of [-.5,.5]) for (const y of [-.5,.5]) {
        const point = new Vector3(x,y,0).applyMatrix4(matrix);
        expect(Math.abs(point.x)).toBeCloseTo(.5);
        expect(Math.abs(point.y)).toBeCloseTo(.5);
        expect(Math.min(Math.abs(point.z),Math.abs(point.z-1))).toBeLessThan(1e-10);
        vertices.add(point.toArray().map(v => Math.round(v*2)).join(','));
      }
    }
    expect(vertices.size).toBe(8);
  });
  it.each([0,.2,.5,.8,1])('keeps shared hinge edges attached at fold=%s', amount => {
    const matrices = foldMatrices(amount);
    for (const face of BOX_FACES) {
      if (face.parent === null) continue;
      const parent = matrices.get(face.parent)!;
      const child = matrices.get(face.id)!;
      for (const t of [-.5,.5]) {
        let a: Vector3, b: Vector3;
        if (face.hinge === 'right') { a = new Vector3(.5,t,0); b = new Vector3(-.5,t,0); }
        else if (face.hinge === 'left') { a = new Vector3(-.5,t,0); b = new Vector3(.5,t,0); }
        else if (face.hinge === 'up') { a = new Vector3(t,.5,0); b = new Vector3(t,-.5,0); }
        else { a = new Vector3(t,-.5,0); b = new Vector3(t,.5,0); }
        expect(a.applyMatrix4(parent).distanceTo(b.applyMatrix4(child))).toBeLessThan(1e-10);
      }
      const a = new Vector3(-.5,-.5,0).applyMatrix4(child);
      const b = new Vector3(.5,-.5,0).applyMatrix4(child);
      expect(a.distanceTo(b)).toBeCloseTo(1,10);
    }
  });
  it('has the independently known opposite pairs 1/6, 2/3, 4/5', () => {
    expect(oppositeFace(1)).toBe(6); expect(oppositeFace(6)).toBe(1);
    expect(oppositeFace(2)).toBe(3); expect(oppositeFace(3)).toBe(2);
    expect(oppositeFace(4)).toBe(5); expect(oppositeFace(5)).toBe(4);
  });
  it('rejects an invalid fold amount', () => { expect(() => foldMatrices(NaN)).toThrow(); });
});
