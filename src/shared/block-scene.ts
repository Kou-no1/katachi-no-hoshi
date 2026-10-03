import * as THREE from 'three';
import type { Block, BlockView } from '../geometry/blocks';
import { COLORS, createThreeStage } from './three-stage';

export type ConstructionView = BlockView | 'diagonal';

// Both construction panels keep this frame, even when the board is empty.
const SPAN = 5.8;
const TARGET = new THREE.Vector3(0, 1.45, 0);
const ORIGIN_MARKER = new THREE.Vector3(-1.65, .1, -1.65);
const OFFSETS: Record<ConstructionView, THREE.Vector3> = {
  diagonal: new THREE.Vector3(7, 6, 8),
  front: new THREE.Vector3(0, 0, 10),
  side: new THREE.Vector3(10, 0, 0),
  top: new THREE.Vector3(0, 10, 0),
};
const SVG_COLORS = [
  ['#add1bd', '#81b8a2', '#6c9f8a'],
  ['#f8bf9f', '#f19b79', '#d88966'],
  ['#b1cfe2', '#89b5d1', '#6c97b3'],
];

function copyBlocks(blocks: readonly Block[]): Block[] {
  if (blocks.length > 27) throw new RangeError('A board can contain at most 27 blocks.');
  const keys = new Set<string>();
  const copy: Block[] = [];
  for (const { x, y, z } of blocks) {
    if (![x, y, z].every(value => Number.isInteger(value) && value >= 0 && value < 3)) {
      throw new RangeError('Block coordinates must be integers between 0 and 2.');
    }
    const key = `${x},${y},${z}`;
    if (!keys.has(key)) {
      keys.add(key);
      copy.push({ x, y, z });
    }
  }
  return copy;
}

export interface BlockPreviewOptions { showOrigin?: boolean; boardOutline?: { color: string; width: number } }
export function blockPreviewSvg(blocks: readonly Block[], view: ConstructionView = 'diagonal', options: BlockPreviewOptions = {}): string {
  if (!Object.hasOwn(OFFSETS, view)) throw new RangeError('Unknown construction view.');
  const validated = copyBlocks(blocks);
  const direction = OFFSETS[view].clone().normalize();
  const preferredUp = view === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = preferredUp.clone().cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const point = (x: number, y: number, z: number): [number, number] => {
    const relative = new THREE.Vector3(x, y, z).sub(TARGET);
    return [relative.dot(right), -relative.dot(up)];
  };
  const points = (vertices: readonly [number, number, number][]) => vertices.map(vertex => point(...vertex).join(',')).join(' ');
  const face = (vertices: readonly [number, number, number][], fill: string) =>
    `<polygon points="${points(vertices)}" fill="${fill}" stroke="#294f49" stroke-width=".026" stroke-linejoin="round"/>`;
  const line = (from: [number, number, number], to: [number, number, number], color: string, width: number) => {
    const [x1, y1] = point(...from);
    const [x2, y2] = point(...to);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  let content = '';
  if (direction.y > 0) content += face([[-1.5, -.01, -1.5], [1.5, -.01, -1.5], [1.5, -.01, 1.5], [-1.5, -.01, 1.5]], '#e0e8da');
  if (direction.x > 0) content += face([[1.5, -.09, -1.5], [1.5, -.09, 1.5], [1.5, -.01, 1.5], [1.5, -.01, -1.5]], '#c4d3c1');
  if (direction.z > 0) content += face([[-1.5, -.09, 1.5], [1.5, -.09, 1.5], [1.5, -.01, 1.5], [-1.5, -.01, 1.5]], '#cfdbca');
  for (let index = 0; index <= 3; index++) {
    const coordinate = index - 1.5;
    content += line([coordinate, .002, -1.5], [coordinate, .002, 1.5], '#98b1a3', .018);
    content += line([-1.5, .002, coordinate], [1.5, .002, coordinate], '#98b1a3', .018);
  }
  // The coral front edge matches the button board's orientation.
  content += line([-1.5, .006, 1.5], [1.5, .006, 1.5], '#f19b79', .036);
  if (options.boardOutline) {
    // Draw floor annotations before cubes so buildings hide the rear edges.
    content += `<polygon points="${points([[-1.5,.012,-1.5],[1.5,.012,-1.5],[1.5,.012,1.5],[-1.5,.012,1.5]])}" fill="none" stroke="${options.boardOutline.color}" stroke-width="${options.boardOutline.width}" stroke-linejoin="round"/>`;
  }

  // For disjoint cubes on this grid, overlapping projections have the same
  // back-to-front order on the positive x/y/z camera directions.
  const ordered = validated.sort((a, b) =>
    direction.x * (a.x - b.x) + direction.y * (a.y - b.y) + direction.z * (a.z - b.z));
  for (const block of ordered) {
    const x = block.x - 1.5;
    const y = block.y;
    const z = block.z - 1.5;
    const color = SVG_COLORS[block.y];
    if (direction.y > 0) content += face([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], color[0]);
    if (direction.x > 0) content += face([[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]], color[2]);
    if (direction.z > 0) content += face([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], color[1]);
  }
  // This annotation sits just beyond the 00 corner and remains visible even
  // when that corner is occupied, including in exact front and side views.
  const [markerX, markerY] = point(ORIGIN_MARKER.x, ORIGIN_MARKER.y, ORIGIN_MARKER.z);
  if (options.showOrigin !== false) content += `<circle cx="${markerX}" cy="${markerY}" r=".13" fill="#e6c573" stroke="#294f49" stroke-width=".02"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-SPAN / 2} ${-SPAN / 2} ${SPAN} ${SPAN}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="display:block;width:100%;height:100%;background:#f9f6ed">${content}</svg>`;
}

export function createBlockScene(host: HTMLElement): {
  setBlocks(blocks: readonly Block[]): void;
  setView(view: ConstructionView): void;
  dispose(): void;
} {
  let stage: ReturnType<typeof createThreeStage> | null = null;
  let blocks: Block[] = [];
  let view: ConstructionView = 'diagonal';
  let disposed = false;
  const group = new THREE.Group();
  const board = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  let cubeGeometry: THREE.BoxGeometry;
  let edgeGeometry: THREE.EdgesGeometry;
  let cubeMaterials: THREE.MeshStandardMaterial[];
  let lineMaterial: THREE.LineBasicMaterial;
  let originMarker: THREE.Mesh | null = null;

  const renderFallback = () => {
    if (!disposed) host.innerHTML = blockPreviewSvg(blocks, view);
  };
  const releaseObjects = () => {
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    geometries.length = materials.length = 0;
    group.clear();
    board.clear();
    originMarker = null;
  };
  const useFallback = () => {
    if (disposed) return;
    if (stage) {
      stage.renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      stage.scene.remove(group, board);
      stage.dispose();
      stage = null;
    }
    releaseObjects();
    renderFallback();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    useFallback();
  };
  const setView = (nextView: ConstructionView) => {
    if (disposed) return;
    if (!Object.hasOwn(OFFSETS, nextView)) throw new RangeError('Unknown construction view.');
    view = nextView;
    if (!stage) { renderFallback(); return; }
    const position = TARGET.clone().add(OFFSETS[view]);
    stage.setCamera(position, TARGET);
    // OrbitControls clamps its poles. Apply the final camera directly so top
    // stays an exact projection, with screen-up pointing toward negative z.
    stage.camera.position.copy(position);
    stage.camera.up.copy(view === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0));
    stage.camera.lookAt(TARGET);
    originMarker?.quaternion.copy(stage.camera.quaternion);
    stage.render();
  };
  const setBlocks = (nextBlocks: readonly Block[]) => {
    if (disposed) return;
    blocks = copyBlocks(nextBlocks);
    if (!stage) { renderFallback(); return; }
    group.clear();
    for (const block of blocks) {
      const mesh = new THREE.Mesh(cubeGeometry, cubeMaterials[block.y]);
      mesh.position.set(block.x - 1, block.y + .5, block.z - 1);
      const edges = new THREE.LineSegments(edgeGeometry, lineMaterial);
      edges.position.copy(mesh.position);
      group.add(mesh, edges);
    }
    stage.render();
  };

  try {
    stage = createThreeStage(host, { span: SPAN, position: TARGET.clone().add(OFFSETS.diagonal), target: TARGET });
    stage.controls.enabled = false;
    cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
    edgeGeometry = new THREE.EdgesGeometry(cubeGeometry);
    cubeMaterials = [COLORS.mint, COLORS.coral, COLORS.sky].map(color => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    lineMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink });
    geometries.push(cubeGeometry, edgeGeometry);
    materials.push(...cubeMaterials, lineMaterial);

    const floorGeometry = new THREE.BoxGeometry(3, .08, 3);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e8da, roughness: 1 });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.position.y = -.05;
    board.add(floor);
    geometries.push(floorGeometry);
    materials.push(floorMaterial);

    const gridCoordinates: number[] = [];
    for (let index = 0; index <= 3; index++) {
      const coordinate = index - 1.5;
      gridCoordinates.push(coordinate, .002, -1.5, coordinate, .002, 1.5);
      gridCoordinates.push(-1.5, .002, coordinate, 1.5, .002, coordinate);
    }
    const gridGeometry = new THREE.BufferGeometry();
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridCoordinates, 3));
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x98b1a3 });
    board.add(new THREE.LineSegments(gridGeometry, gridMaterial));
    geometries.push(gridGeometry);
    materials.push(gridMaterial);

    const markerGeometry = new THREE.CircleGeometry(.13, 24);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: COLORS.yellow, depthTest: false, depthWrite: false });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(ORIGIN_MARKER);
    marker.renderOrder = 10;
    originMarker = marker;
    board.add(marker);
    geometries.push(markerGeometry);
    materials.push(markerMaterial);

    const frontGeometry = new THREE.CylinderGeometry(.018, .018, 3, 10);
    const frontMaterial = new THREE.MeshBasicMaterial({ color: COLORS.coral });
    const front = new THREE.Mesh(frontGeometry, frontMaterial);
    front.rotation.z = Math.PI / 2;
    front.position.set(0, .006, 1.5);
    board.add(front);
    geometries.push(frontGeometry);
    materials.push(frontMaterial);
    stage.scene.add(board, group);
    stage.renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    setView(view);
  } catch {
    useFallback();
  }

  return {
    setBlocks,
    setView,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (stage) {
        stage.renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        stage.scene.remove(group, board);
        stage.dispose();
        stage = null;
      } else {
        host.replaceChildren();
      }
      releaseObjects();
    },
  };
}
