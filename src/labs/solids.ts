import * as THREE from 'three';
import { cubeSection, planeBasis, revolutionMesh, revolutionProfile, revolvePoint, SECTION_PLANES, sectionCoordinates, type Point2, type Point3, type RevolutionKind, type SectionPlane } from '../geometry/solids';
import { COLORS, createThreeStage } from '../shared/three-stage';
import type { GameContext } from '../types';
import './solids.css';

type Mode = 'revolve' | 'section';
type View = 'diagonal' | 'front' | 'side' | 'top';
type SectionKind = keyof typeof SECTION_PLANES;
interface Task { id: RevolutionKind | SectionKind; title: string; question: string; axis: string; hint: string; explanation: string }
const REVOLVE_TASKS: Task[] = [
  { id: 'cylinder', title: '長方形を回すと？', question: '長方形の左の辺を軸にして、1回転させるよ。できる回転体を予想しよう。', axis: '黄色の軸は、長方形の左の辺。高さ2、軸からの距離1。', hint: '軸から同じ距離の点は、回すと円になるよ。上と下の辺にも注目。', explanation: '円柱になるね。軸からの距離が、上から下まで同じだからだよ。' },
  { id: 'cone', title: '直角三角形を回すと？', question: '直角をはさむ縦の辺を軸にして、1回転させるよ。どんな回転体になるかな？', axis: '黄色の軸は、直角三角形の縦の辺。高さ2、下の辺の長さ1。', hint: '軸から輪郭までの距離は、上へ行くほど小さくなるよ。', explanation: '円錐になるね。斜めの辺が回り、上の頂点へ向かって細くなるよ。' },
  { id: 'sphere', title: '半円を回すと？', question: '半円の直径を軸にして、1回転させるよ。弧の向きと軸を見て、予想しよう。', axis: '黄色の軸は、半円の直径。半径1、直径2。', hint: '直径が軸だよ。上下の端は動かず、まんなかは大きな円をえがくよ。', explanation: '球になるね。半円を直径のまわりに回すと、中心からの距離がいつも1の立体になるよ。' },
];
const SECTION_TASKS: Task[] = [
  { id: 'triangle', title: '角の近くを切ると？', question: '透明な平面で立方体を切るよ。切り口の形と、頂点の数を予想しよう。', axis: '立方体の辺は2。切る平面は x＋y＋z＝2。', hint: 'この平面は、ひとつの角の近くで3本の辺を通るよ。', explanation: '断面は三角形。平面と3本の辺が交わり、3つの頂点ができるよ。' },
  { id: 'rectangle', title: '縦に、ななめに切ると？', question: '上の面と下の面の対角線を通る平面で切るよ。断面の形と頂点の数は？', axis: '立方体の辺は2。切る平面は x−z＝0。', hint: '縦の長さは立方体の辺と同じ。横の長さは面の対角線になるよ。', explanation: '断面は長方形。縦は2、横は2×√2で、4つの頂点があるよ。' },
  { id: 'hexagon', title: '中心を、ななめに切ると？', question: '中心を通り、6本の辺を横切る平面で切るよ。断面の形と頂点の数は？', axis: '立方体の辺は2。切る平面は x＋y＋z＝0。', hint: '3つの向きの辺を、それぞれ2本ずつ通るよ。平面を正面から見てみよう。', explanation: '断面は正六角形。6つの頂点が、立方体の6本の辺のまんなかにできるよ。' },
];
const REVOLVE_CHOICES = [{ id: 'cylinder', label: '円柱' }, { id: 'cone', label: '円錐' }, { id: 'sphere', label: '球' }];
const SECTION_CHOICES = [{ id: 'triangle', label: '三角形・頂点3こ' }, { id: 'rectangle', label: '長方形・頂点4こ' }, { id: 'hexagon', label: '六角形・頂点6こ' }];
const VIEW_NAMES: Record<View, string> = { diagonal: 'ななめ', front: '前', side: '右よこ', top: '上' };
const CAMERA: Record<View, THREE.Vector3> = {
  diagonal: new THREE.Vector3(6, 4, 7), front: new THREE.Vector3(0, 0, 10), side: new THREE.Vector3(10, 0, 0), top: new THREE.Vector3(0, 10, 0),
};
const cubeVertices: Point3[] = Array.from({ length: 8 }, (_, index) => [index & 4 ? 1 : -1, index & 2 ? 1 : -1, index & 1 ? 1 : -1]);

function profileSvg(kind: RevolutionKind): string {
  const profile = revolutionProfile(kind);
  return `<svg viewBox="0 0 180 220" aria-hidden="true"><polygon points="${profile.map(([radius, y]) => `${45 + radius * 90},${110 - y * 80}`).join(' ')}" fill="#add1bd" stroke="#294f49" stroke-width="2"/><line x1="45" y1="16" x2="45" y2="204" stroke="#d0a548" stroke-width="4" stroke-dasharray="6 4"/><text x="27" y="18" text-anchor="middle" fill="#745b30" font-size="12">じく</text></svg>`;
}

function sectionSvg(points: readonly Point3[], plane: SectionPlane): string {
  const flat = sectionCoordinates(points, plane);
  const extent = Math.max(1.8, ...flat.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])) + .28;
  return `<svg viewBox="${-extent} ${-extent} ${extent * 2} ${extent * 2}" aria-hidden="true"><polygon points="${flat.map(([x, y]) => `${x},${-y}`).join(' ')}" fill="#f8bf9f" stroke="#294f49" stroke-width=".04" stroke-linejoin="round"/>${flat.map(([x, y], index) => `<circle cx="${x}" cy="${-y}" r=".07" fill="#294f49"/><text x="${x * 1.13}" y="${-y * 1.13 + .06}" text-anchor="middle" fill="#294f49" font-size=".24">${index + 1}</text>`).join('')}</svg>`;
}

function planeCorners(plane: SectionPlane): Point3[] {
  const { origin, u, v } = planeBasis(plane);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [
    origin[0] + 1.6 * (a * u[0] + b * v[0]), origin[1] + 1.6 * (a * u[1] + b * v[1]), origin[2] + 1.6 * (a * u[2] + b * v[2]),
  ]);
}

function fallbackSvg(mode: Mode, task: Task, angle: number, view: View, revealed: boolean): string {
  const direction = CAMERA[view].clone().normalize();
  const preferredUp = view === 'top' ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = preferredUp.clone().cross(direction).normalize(); const up = direction.clone().cross(right);
  const project = (point: Point3): Point2 => { const p = new THREE.Vector3(...point); return [p.dot(right), -p.dot(up)]; };
  const vertices = (points: readonly Point3[]) => points.map(point => project(point).join(',')).join(' ');
  const polygon = (points: readonly Point3[], fill: string, opacity = 1, stroke = '#294f49') => `<polygon points="${vertices(points)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width=".018" stroke-linejoin="round"/>`;
  const line = (a: Point3, b: Point3, color = '#294f49', width = .024) => {
    const [x1, y1] = project(a); const [x2, y2] = project(b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"/>`;
  };
  let content = '';
  if (mode === 'revolve') {
    const mesh = revolutionMesh(task.id as RevolutionKind, angle, 24);
    const triangles = mesh.triangles.map(indices => indices.map(index => mesh.vertices[index]));
    triangles.sort((a, b) => a.reduce((sum, point) => sum + new THREE.Vector3(...point).dot(direction), 0) - b.reduce((sum, point) => sum + new THREE.Vector3(...point).dot(direction), 0));
    const light = new THREE.Vector3(5, 8, 7).normalize();
    content = triangles.map(triangle => {
      const normal = new THREE.Vector3(...triangle[1]).sub(new THREE.Vector3(...triangle[0])).cross(new THREE.Vector3(...triangle[2]).sub(new THREE.Vector3(...triangle[0]))).normalize();
      const brightness = .72 + .4 * Math.max(0, normal.dot(light));
      const color = `#${[129, 184, 162].map(channel => Math.min(255, Math.round(channel * brightness)).toString(16).padStart(2, '0')).join('')}`;
      return polygon(triangle, color, 1, color);
    }).join('');
    if (angle === 0) {
      const profile = revolutionProfile(task.id as RevolutionKind).map(point => revolvePoint(point, 0));
      profile.forEach((point, index) => { content += line(point, profile[(index + 1) % profile.length], '#cb805c'); });
    }
    content += line([0, -1.5, 0], [0, 1.5, 0], '#d0a548', .05);
  } else {
    const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    content = faces.map(indices => polygon(indices.map(index => cubeVertices[index]), '#89b5d1', .12)).join('');
    const plane = SECTION_PLANES[task.id as SectionKind];
    content += polygon(planeCorners(plane), '#81b8a2', .18, '#81b8a2');
    cubeVertices.forEach((point, index) => { for (const bit of [1, 2, 4]) if (!(index & bit)) content += line(point, cubeVertices[index | bit]); });
    if (revealed) {
      const section = cubeSection(plane);
      content += polygon(section, '#f19b79', .85);
      content += section.map(point => { const [x, y] = project(point); return `<circle cx="${x}" cy="${y}" r=".045" fill="#294f49"/>`; }).join('');
    }
  }
  return `<svg viewBox="-2.6 -2.6 5.2 5.2" preserveAspectRatio="xMidYMid meet" aria-hidden="true" style="width:100%;height:100%;display:block">${content}</svg>`;
}

export function mountSolids(container: HTMLElement, context: GameContext): () => void {
  let mode: Mode = 'revolve'; let taskIndex = 0; let angle = 0; let view: View = 'diagonal';
  let selected: string | null = null; let revealed = false; let disposed = false; let animation = 0;
  const awarded = new Set<string>(); const abort = new AbortController();
  const group = new THREE.Group(); let stage: ReturnType<typeof createThreeStage> | null = null;
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  container.innerHTML = `<div class="solids-mode-picker" aria-label="研究をえらぶ"><button type="button" class="button button-soft" data-solids-mode="revolve" aria-pressed="true">① 回転体</button><button type="button" class="button button-soft" data-solids-mode="section" aria-pressed="false">② 切断</button></div>
    <div class="solids-task-picker" aria-label="課題をえらぶ"></div><div class="lab-layout solids-lab"><section class="lab-stage"><div class="stage-toolbar"><h2 id="solids-stage-title">平面の形を回してみよう</h2><span class="badge" id="solids-task-progress">1 / 3</span></div><div class="stage-workspace"><div class="canvas-host solids-canvas" role="img" aria-label="図形を動かしてたしかめる画面"></div><aside class="stage-controller solids-controller" aria-label="図形の操作"><h3>動かしてみよう</h3><div id="solids-turn-controls"><label class="solids-angle-label" for="solids-angle">回す角度 <output id="solids-angle-output">0°</output></label><input id="solids-angle" type="range" min="0" max="360" step="5" value="0"><div class="solids-turn-buttons"><button type="button" class="button button-soft" data-solids-angle="0">0°</button><button type="button" class="button button-soft" data-solids-angle="180">180°</button><button type="button" class="button button-primary" data-solids-angle="360">360°</button></div></div><button type="button" class="button button-primary" id="solids-reveal" hidden>断面を見る</button><h3>見る向き</h3><div class="solids-view-buttons">${(['diagonal', 'front', 'side', 'top'] as View[]).map(name => `<button type="button" class="button button-soft" data-solids-view="${name}" aria-pressed="${name === view}">${VIEW_NAMES[name]}</button>`).join('')}</div></aside></div><p class="stage-caption" id="solids-axis-note"></p><p class="solids-fallback-note small-text" hidden>この画面では平面の表示でたしかめるよ。角度や見る向きの操作は使えるよ。</p></section><aside class="lab-sidebar"><section class="panel"><div class="task-kicker" id="solids-kicker">MISSION / 回転体</div><h2 class="task-title" id="solids-question-title"></h2><p class="task-description" id="solids-question"></p><div class="solids-answers" aria-label="予想をえらぶ"></div><button type="button" class="button button-primary solids-check" id="solids-check" disabled>たしかめる</button><p class="feedback" id="solids-feedback" aria-live="polite" aria-atomic="true"></p><div class="button-row"><button type="button" class="button button-soft" id="solids-hint" aria-expanded="false">ヒント</button><button type="button" class="button button-soft" id="solids-next">つぎの課題</button></div><p class="hint solids-hint" hidden></p></section><section class="panel solids-reference-panel"><h3 class="panel-title" id="solids-reference-title">もとの平面図形</h3><div class="solids-reference"></div><p class="small-text" id="solids-reference-note"></p></section></aside></div>`;
  const $ = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const host = $('.solids-canvas'); const slider = $<HTMLInputElement>('#solids-angle');
  const task = () => (mode === 'revolve' ? REVOLVE_TASKS : SECTION_TASKS)[taskIndex];
  const disposeScene = () => {
    resources.forEach(resource => resource.dispose()); resources.length = 0; group.clear();
  };
  const addMesh = (vertices: readonly Point3[], triangles: readonly (readonly [number, number, number])[], material: THREE.Material) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flatMap(point => [...point]), 3));
    geometry.setIndex(triangles.flatMap(triangle => [...triangle])); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); group.add(mesh); resources.push(geometry, material); return mesh;
  };
  const addLines = (points: readonly Point3[], color: number, closed = false, depthTest = true) => {
    const segments: number[] = [];
    for (let index = 0; index < points.length - (closed ? 0 : 1); index++) segments.push(...points[index], ...points[(index + 1) % points.length]);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
    const material = new THREE.LineBasicMaterial({ color, depthTest, depthWrite: false, transparent: true });
    const line = new THREE.LineSegments(geometry, material); group.add(line); resources.push(geometry, material); return line;
  };
  const renderScene = () => {
    if (disposed) return;
    if (!stage) { host.innerHTML = fallbackSvg(mode, task(), angle, view, revealed); return; }
    disposeScene();
    if (mode === 'revolve') {
      const data = revolutionMesh(task().id as RevolutionKind, angle);
      addMesh(data.vertices, data.triangles, new THREE.MeshStandardMaterial({ color: COLORS.mint, side: THREE.DoubleSide, roughness: 1 }));
      addLines(revolutionProfile(task().id as RevolutionKind).map(point => revolvePoint(point, angle)), COLORS.coral, true);
      const axisGeometry = new THREE.CylinderGeometry(.014, .014, 3, 12);
      const axisMaterial = new THREE.MeshBasicMaterial({ color: COLORS.yellow, depthTest: false });
      const axis = new THREE.Mesh(axisGeometry, axisMaterial); axis.renderOrder = 4; group.add(axis); resources.push(axisGeometry, axisMaterial);
    } else {
      const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
      const cubeMaterial = new THREE.MeshStandardMaterial({ color: COLORS.sky, transparent: true, opacity: .2, depthWrite: false, roughness: 1 });
      group.add(new THREE.Mesh(cubeGeometry, cubeMaterial)); resources.push(cubeGeometry, cubeMaterial);
      const edgeGeometry = new THREE.EdgesGeometry(cubeGeometry); const edgeMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink, depthWrite: false });
      group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial)); resources.push(edgeGeometry, edgeMaterial);
      const plane = SECTION_PLANES[task().id as SectionKind];
      const planeMesh = addMesh(planeCorners(plane), [[0, 1, 2], [0, 2, 3]], new THREE.MeshBasicMaterial({ color: COLORS.mint, transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
      planeMesh.renderOrder = 1;
      if (revealed) {
        const section = cubeSection(plane);
        const triangles: [number, number, number][] = [];
        for (let index = 1; index < section.length - 1; index++) triangles.push([0, index, index + 1]);
        const cut = addMesh(section, triangles, new THREE.MeshBasicMaterial({ color: COLORS.coral, transparent: true, opacity: .88, side: THREE.DoubleSide, depthWrite: false, depthTest: false }));
        cut.renderOrder = 2; addLines(section, COLORS.ink, true, false).renderOrder = 3;
        const vertexGeometry = new THREE.SphereGeometry(.038, 10, 8); const vertexMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ink, depthTest: false, depthWrite: false, transparent: true });
        resources.push(vertexGeometry, vertexMaterial);
        section.forEach(point => { const mesh = new THREE.Mesh(vertexGeometry, vertexMaterial); mesh.position.set(...point); mesh.renderOrder = 4; group.add(mesh); });
      }
    }
    stage.render();
  };
  const renderReference = () => {
    $('#solids-reference-title').textContent = mode === 'revolve' ? 'もとの平面図形' : '取り出した断面';
    if (mode === 'revolve') {
      $('.solids-reference').innerHTML = profileSvg(task().id as RevolutionKind);
      $('#solids-reference-note').textContent = '黄色の線が回す軸。もとの形と見くらべよう。';
    } else if (revealed) {
      const plane = SECTION_PLANES[task().id as SectionKind]; const points = cubeSection(plane);
      $('.solids-reference').innerHTML = sectionSvg(points, plane);
      $('#solids-reference-note').textContent = `平面を正面から見た形。頂点は${points.length}こ。番号は交点の順だよ。`;
    } else {
      $('.solids-reference').innerHTML = '<div class="solids-preview-placeholder">まずは形を予想しよう</div>';
      $('#solids-reference-note').textContent = '「断面を見る」で、切り口だけを取り出せるよ。';
    }
  };
  const setView = (value: View) => {
    view = value;
    if (stage) {
      stage.setCamera(CAMERA[value], new THREE.Vector3());
      stage.camera.position.copy(CAMERA[value]); stage.camera.up.set(0, value === 'top' ? 0 : 1, value === 'top' ? -1 : 0);
      stage.camera.lookAt(0, 0, 0); stage.render();
    } else renderScene();
    container.querySelectorAll<HTMLElement>('[data-solids-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.solidsView === value)));
  };
  const setAngle = (value: number) => {
    angle = Math.max(0, Math.min(360, value)); slider.value = String(Math.round(angle));
    $('#solids-angle-output').textContent = `${Math.round(angle)}°`; renderScene();
  };
  const animateTo = (value: number) => {
    cancelAnimationFrame(animation);
    if (context.reducedMotion || !stage) { setAngle(value); return; }
    const start = angle; const began = performance.now();
    const tick = (time: number) => {
      if (disposed) return;
      const progress = Math.min((time - began) / 1100, 1);
      setAngle(start + (value - start) * progress);
      if (progress < 1) animation = requestAnimationFrame(tick);
    };
    animation = requestAnimationFrame(tick);
  };
  const revealSection = () => { revealed = true; renderScene(); renderReference(); $('#solids-reveal').textContent = '断面を表示中'; };
  const showTask = () => {
    cancelAnimationFrame(animation); angle = 0; selected = null; revealed = false;
    const current = task(); const tasks = mode === 'revolve' ? REVOLVE_TASKS : SECTION_TASKS;
    $('#solids-stage-title').textContent = mode === 'revolve' ? '平面の形を回してみよう' : '立方体の切り口を見てみよう';
    $('#solids-kicker').textContent = `MISSION / ${mode === 'revolve' ? '回転体' : '切断'}`;
    $('#solids-task-progress').textContent = `${taskIndex + 1} / 3`;
    $('#solids-question-title').textContent = current.title; $('#solids-question').textContent = current.question; $('#solids-axis-note').textContent = current.axis;
    $('#solids-turn-controls').hidden = mode !== 'revolve'; $('#solids-reveal').hidden = mode !== 'section'; $('#solids-reveal').textContent = '断面を見る';
    $('.solids-task-picker').innerHTML = tasks.map((item, index) => `<button type="button" class="button button-soft" data-solids-task="${index}" aria-pressed="${index === taskIndex}">${index + 1}. ${item.title}</button>`).join('');
    const choices = mode === 'revolve' ? REVOLVE_CHOICES : SECTION_CHOICES;
    $('.solids-answers').innerHTML = choices.map(choice => `<button type="button" class="button solids-answer" data-solids-answer="${choice.id}" aria-pressed="false">${choice.label}</button>`).join('');
    $<HTMLButtonElement>('#solids-check').disabled = true; $('#solids-feedback').textContent = ''; $('#solids-feedback').className = 'feedback';
    $('.solids-hint').hidden = true; $('.solids-hint').textContent = current.hint; $('#solids-hint').setAttribute('aria-expanded', 'false');
    slider.value = '0'; $('#solids-angle-output').textContent = '0°'; renderReference(); renderScene(); setView('diagonal');
    container.querySelectorAll<HTMLElement>('[data-solids-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.solidsMode === mode)));
  };

  const useFallback = () => {
    if (disposed) return;
    cancelAnimationFrame(animation);
    if (stage) {
      stage.renderer.domElement.removeEventListener('webglcontextlost', onContextLost); stage.scene.remove(group); stage.dispose(); stage = null;
    }
    disposeScene(); $('.solids-fallback-note').hidden = false; renderScene();
  };
  const onContextLost = (event: Event) => { event.preventDefault(); useFallback(); };
  try {
    stage = createThreeStage(host, { span: 5.2, position: CAMERA.diagonal }); stage.controls.enabled = false; stage.scene.add(group);
    stage.renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  } catch { useFallback(); }
  container.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || !container.contains(button)) return;
    if (button.dataset.solidsMode) { mode = button.dataset.solidsMode as Mode; taskIndex = 0; showTask(); }
    else if (button.dataset.solidsTask !== undefined) { taskIndex = Number(button.dataset.solidsTask); showTask(); }
    else if (button.dataset.solidsView) setView(button.dataset.solidsView as View);
    else if (button.dataset.solidsAngle !== undefined) animateTo(Number(button.dataset.solidsAngle));
    else if (button.dataset.solidsAnswer) {
      selected = button.dataset.solidsAnswer; $<HTMLButtonElement>('#solids-check').disabled = false;
      container.querySelectorAll<HTMLElement>('[data-solids-answer]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      $('#solids-feedback').textContent = ''; $('#solids-feedback').className = 'feedback';
    } else if (button.id === 'solids-reveal') revealSection();
    else if (button.id === 'solids-next') { taskIndex = (taskIndex + 1) % 3; showTask(); }
    else if (button.id === 'solids-hint') { const hint = $('.solids-hint'); hint.hidden = !hint.hidden; button.setAttribute('aria-expanded', String(!hint.hidden)); }
    else if (button.id === 'solids-check' && selected !== null) {
      const correct = selected === task().id;
      $('#solids-feedback').className = `feedback ${correct ? 'success' : 'error'}`;
      const message = correct ? `発見！ ${task().explanation}` : 'もう一度ためそう。動かして輪郭を見たり、ヒントを使ったりして考えよう。';
      $('#solids-feedback').textContent = message; context.onNarrate?.(message);
      if (mode === 'revolve') animateTo(360); else revealSection();
      const id = `solids-${mode}-${task().id}`;
      if (correct && !awarded.has(id)) { awarded.add(id); context.onComplete(id, task().title); }
    }
  }, { signal: abort.signal });
  slider.addEventListener('input', () => { cancelAnimationFrame(animation); setAngle(Number(slider.value)); }, { signal: abort.signal });
  showTask();
  return () => {
    disposed = true; cancelAnimationFrame(animation); abort.abort();
    if (stage) { stage.renderer.domElement.removeEventListener('webglcontextlost', onContextLost); stage.scene.remove(group); stage.dispose(); stage = null; }
    disposeScene(); container.replaceChildren();
  };
}
