import { Matrix4, Vector3 } from 'three';

export const BOX_FACES = [
  { id: 1, parent: null, hinge: null, color: '#81b8a2' },
  { id: 2, parent: 1, hinge: 'right', color: '#f19b79' },
  { id: 3, parent: 1, hinge: 'left', color: '#89b5d1' },
  { id: 4, parent: 1, hinge: 'up', color: '#e6c573' },
  { id: 5, parent: 1, hinge: 'down', color: '#b7a1c8' },
  { id: 6, parent: 4, hinge: 'up', color: '#d9aa8c' },
] as const;
export type FaceId = typeof BOX_FACES[number]['id'];
type Hinge = 'right' | 'left' | 'up' | 'down';

function localFold(hinge: Hinge, angle: number): Matrix4 {
  const x = hinge === 'right' ? 0.5 : hinge === 'left' ? -0.5 : 0;
  const y = hinge === 'up' ? 0.5 : hinge === 'down' ? -0.5 : 0;
  const rotation = x ? new Matrix4().makeRotationY(-Math.sign(x) * angle) : new Matrix4().makeRotationX(Math.sign(y) * angle);
  return new Matrix4().makeTranslation(x, y, 0).multiply(rotation).multiply(new Matrix4().makeTranslation(x, y, 0));
}

/** Fold a verified cross net around each shared edge. Face 6 inherits face 4's motion. */
export function foldMatrices(amount: number): Map<FaceId, Matrix4> {
  if (!Number.isFinite(amount)) throw new Error('Fold amount must be finite');
  const angle = Math.max(0, Math.min(amount, 1)) * Math.PI / 2;
  const matrices = new Map<FaceId, Matrix4>();
  for (const face of BOX_FACES) {
    const matrix = face.parent === null ? new Matrix4() : matrices.get(face.parent)!.clone().multiply(localFold(face.hinge!, angle));
    matrices.set(face.id, matrix);
  }
  return matrices;
}

export function facePose(id: FaceId, amount: number) {
  const matrix = foldMatrices(amount).get(id)!;
  return { center: new Vector3().applyMatrix4(matrix), normal: new Vector3(0, 0, 1).transformDirection(matrix), matrix };
}

export function oppositeFace(id: FaceId): FaceId {
  const normal = facePose(id, 1).normal;
  return BOX_FACES.find(face => face.id !== id && facePose(face.id, 1).normal.dot(normal) < -0.999)!.id;
}
