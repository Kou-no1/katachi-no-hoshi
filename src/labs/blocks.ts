import * as THREE from 'three';
import { createThreeStage, COLORS } from '../shared/three-stage';
import { BUILDINGS, blocksInLayer, countBlocks, projectBlocks, type Block, type BlockView, type ProjectedCell } from '../geometry/blocks';
import type { GameContext } from '../types';
import './blocks.css';

type View = BlockView | 'diagonal';
const VIEW_NAMES: Record<View, string> = { front: '前', side: '右よこ', top: '上', diagonal: 'ななめ' };
const VIEWS: BlockView[] = ['front', 'side', 'top'];

function projectionSvg(cells: readonly ProjectedCell[], frame: readonly ProjectedCell[] = cells): string {
  const minU = Math.min(...frame.map((cell) => cell.u));
  const maxU = Math.max(...frame.map((cell) => cell.u));
  const minV = Math.min(...frame.map((cell) => cell.v));
  const maxV = Math.max(...frame.map((cell) => cell.v));
  const width = (maxU - minU + 1) * 32 + 16;
  const height = (maxV - minV + 1) * 32 + 16;
  return `<svg viewBox="0 0 ${width} ${height}" aria-hidden="true">${cells.map((cell) =>
    `<rect x="${8 + (cell.u - minU) * 32}" y="${8 + (maxV - cell.v) * 32}" width="32" height="32" fill="#89b5d1" stroke="#294f49" stroke-width="1.4" />`).join('')}</svg>`;
}

function diagonalSvg(blocks: readonly Block[]): string {
  if (!blocks.length) return '';
  const point = (x: number, y: number, z: number): [number, number] => [(x - z) * 40, (x + z) * 21 - y * 43];
  const allPoints = blocks.flatMap(({ x, y, z }) => [0, 1].flatMap((dx) => [0, 1].flatMap((dy) => [0, 1].map((dz) => point(x + dx, y + dy, z + dz)))));
  const minX = Math.min(...allPoints.map(([x]) => x)) - 15;
  const minY = Math.min(...allPoints.map(([, y]) => y)) - 15;
  const maxX = Math.max(...allPoints.map(([x]) => x)) + 15;
  const maxY = Math.max(...allPoints.map(([, y]) => y)) + 15;
  const face = (vertices: [number, number][], fill: string) => `<polygon points="${vertices.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="#294f49" stroke-width="1.3" stroke-linejoin="round" />`;
  const colors = [['#add1bd', '#81b8a2', '#6c9f8a'], ['#f8bf9f', '#f19b79', '#d88966']];
  return `<svg viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" aria-hidden="true">${[...blocks].sort((a, b) => a.x + a.z - b.x - b.z || a.y - b.y).map(({ x, y, z }) => {
    const color = colors[y % colors.length];
    return face([point(x, y + 1, z), point(x + 1, y + 1, z), point(x + 1, y + 1, z + 1), point(x, y + 1, z + 1)], color[0])
      + face([point(x + 1, y, z), point(x + 1, y, z + 1), point(x + 1, y + 1, z + 1), point(x + 1, y + 1, z)], color[2])
      + face([point(x, y, z + 1), point(x + 1, y, z + 1), point(x + 1, y + 1, z + 1), point(x, y + 1, z + 1)], color[1]);
  }).join('')}</svg>`;
}

function silhouetteChoices(cells: readonly ProjectedCell[], seed: number) {
  const keys = new Set(cells.map(({ u, v }) => `${u},${v}`));
  const minU = Math.min(...cells.map((cell) => cell.u));
  const maxU = Math.max(...cells.map((cell) => cell.u));
  const minV = Math.min(...cells.map((cell) => cell.v));
  const maxV = Math.max(...cells.map((cell) => cell.v));
  let extra: ProjectedCell | undefined;
  for (let v = minV; v <= maxV; v++) for (let u = minU; u <= maxU; u++) {
    if (!extra && !keys.has(`${u},${v}`)) extra = { u, v };
  }
  extra ??= { u: maxU + 1, v: minV };
  const variants = [[...cells], cells.slice(1), [...cells, extra]];
  const correctIndex = seed % 3;
  const choices = variants.map((_, index) => variants[(index - correctIndex + 3) % 3]);
  return { choices, correctIndex, frame: [...cells, extra] };
}

export function mountBlocks(container: HTMLElement, context: GameContext): () => void {
  let buildingIndex = 0;
  let mode: 'count' | 'view' = 'count';
  let view: View = 'diagonal';
  let questionView: BlockView = 'front';
  let layer: number | null = null;
  let hintOpen = false;
  let answer: number | null = null;
  let selectedChoice: number | null = null;
  const solvedCounts = new Set<string>();
  const solvedViews = new Set<string>();
  const awarded = new Set<string>();
  const abort = new AbortController();
  let stage: ReturnType<typeof createThreeStage> | null = null;
  let buildingGroup: THREE.Group | null = null;
  let currentTarget = new THREE.Vector3();
  let cubeObjects: { y: number; mesh: THREE.Mesh; edges: THREE.LineSegments }[] = [];

  container.innerHTML = `<div class="blocks-building-picker" aria-label="建物をえらぶ"></div>
    <div class="lab-layout">
      <section class="lab-stage" aria-label="積み木の建物">
        <div class="stage-toolbar"><h2>建物をたんけん</h2><span class="badge">くるくる回せるよ</span></div>
        <div class="stage-workspace">
          <div class="canvas-host" id="blocks-canvas" role="img" aria-label="積み木の建物。ボタンで見る向きを変えられます。"></div>
          <aside class="stage-controller blocks-controller" aria-label="見る向きの操作">
            <h3 class="blocks-controller-title">見る向き</h3>
            <div class="blocks-camera-buttons">${(['diagonal', 'front', 'side', 'top'] as View[]).map((name) => `<button type="button" class="button button-soft" data-camera="${name}" aria-pressed="${name === view}">${VIEW_NAMES[name]}</button>`).join('')}</div>
          </aside>
        </div>
        <div class="blocks-stage-caption"><span id="blocks-view-label">ななめから 見ています</span><span id="blocks-interaction">指やマウスで くるくる回せるよ</span></div>
      </section>
      <aside class="lab-sidebar">
        <section class="panel">
          <div class="task-kicker">MISSION / 積み木たんけん</div>
          <h2 class="task-title" id="blocks-building-name"></h2>
          <div class="blocks-mode-picker"><button type="button" class="button button-soft" data-mode="count">① いくつある？</button><button type="button" class="button button-soft" data-mode="view">② 見え方を予想</button></div>
          <div id="blocks-question"></div>
          <button type="button" class="button button-primary blocks-check" id="blocks-check">たしかめる</button>
          <p class="feedback" id="blocks-feedback" aria-live="polite" aria-atomic="true"></p>
          <div class="blocks-hint"><button type="button" class="button button-soft" id="blocks-hint-toggle" aria-expanded="false">ヒントを見る</button><div id="blocks-hint-content" hidden></div></div>
        </section>
        <p class="small-text">「右よこ」は右側から。「上」は前が下になる向きだよ。見えないところにも、積み木があるかも！</p>
      </aside>
    </div>`;

  const get = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const host = get('#blocks-canvas');
  const feedback = (message: string, success = false) => {
    const element = get('#blocks-feedback');
    element.textContent = message;
    element.dataset.state = success ? 'success' : 'hint';
  };
  try {
    stage = createThreeStage(host, { span: 5.8, position: new THREE.Vector3(7, 6, 8) });
    stage.controls.addEventListener('start', () => {
      get('#blocks-view-label').textContent = '自由に 見ています';
      container.querySelectorAll<HTMLElement>('[data-camera]').forEach((button) => {
        button.setAttribute('aria-pressed', 'false');
        button.classList.remove('blocks-selected');
      });
    });
  } catch {
    host.replaceChildren();
    host.classList.add('blocks-fallback');
    get('#blocks-interaction').textContent = 'ボタンで 向きを変えてみよう';
  }

  const current = () => BUILDINGS[buildingIndex];
  const updatePicker = () => {
    get('.blocks-building-picker').innerHTML = BUILDINGS.map((building, index) => `<button type="button" class="button button-soft ${index === buildingIndex ? 'blocks-selected' : ''} ${awarded.has(building.id) ? 'blocks-done' : ''}" data-building="${index}" aria-pressed="${index === buildingIndex}">${index + 1}. ${building.name}${awarded.has(building.id) ? ' ✓' : ''}</button>`).join('');
  };
  const fallbackRender = () => {
    if (stage) return;
    const blocks = layer === null ? current().blocks : blocksInLayer(current().blocks, layer);
    host.innerHTML = view === 'diagonal' ? diagonalSvg(blocks) : projectionSvg(projectBlocks(blocks, view));
  };
  const showLayer = (value: number | null) => {
    layer = value;
    for (const item of cubeObjects) item.mesh.visible = item.edges.visible = layer === null || item.y === layer;
    stage?.render();
    fallbackRender();
    container.querySelectorAll<HTMLElement>('[data-layer]').forEach((button) => {
      const active = button.dataset.layer === String(layer ?? 'all');
      button.classList.toggle('blocks-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    get('#blocks-view-label').textContent = `${VIEW_NAMES[view]}から${layer === null ? '' : `・${layer + 1}だんめだけ`} 見ています`;
  };
  const setView = (value: View) => {
    view = value;
    if (stage) {
      const positions: Record<View, THREE.Vector3> = {
        diagonal: currentTarget.clone().add(new THREE.Vector3(7, 6, 8)),
        front: currentTarget.clone().add(new THREE.Vector3(0, 0, 10)),
        side: currentTarget.clone().add(new THREE.Vector3(10, 0, 0)),
        top: currentTarget.clone().add(new THREE.Vector3(0, 10, 0)),
      };
      stage.setCamera(positions[value], currentTarget);
      // Preserve an exact top projection instead of the orbit control's pole clamp.
      if (value === 'top') {
        stage.camera.position.copy(positions.top);
        stage.camera.up.set(0, 0, -1);
        stage.camera.lookAt(currentTarget);
        stage.render();
      }
    }
    fallbackRender();
    container.querySelectorAll<HTMLElement>('[data-camera]').forEach((button) => {
      const active = button.dataset.camera === value;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('blocks-selected', active);
    });
    get('#blocks-view-label').textContent = `${VIEW_NAMES[view]}から${layer === null ? '' : `・${layer + 1}だんめだけ`} 見ています`;
  };
  const buildScene = () => {
    if (!stage) { setView('diagonal'); return; }
    if (buildingGroup) {
      stage.scene.remove(buildingGroup);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      buildingGroup.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    }
    buildingGroup = new THREE.Group();
    cubeObjects = [];
    const blocks = current().blocks;
    const maxX = Math.max(...blocks.map((block) => block.x));
    const maxY = Math.max(...blocks.map((block) => block.y));
    const maxZ = Math.max(...blocks.map((block) => block.z));
    currentTarget.set(0, (maxY + 1) / 2, 0);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const materials = [COLORS.mint, COLORS.coral, COLORS.sky].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    const lineMaterial = new THREE.LineBasicMaterial({ color: COLORS.ink });
    for (const block of blocks) {
      const mesh = new THREE.Mesh(geometry, materials[block.y % materials.length]);
      mesh.position.set(block.x - maxX / 2, block.y + .5, block.z - maxZ / 2);
      const edges = new THREE.LineSegments(edgeGeometry, lineMaterial);
      edges.position.copy(mesh.position);
      buildingGroup.add(mesh, edges);
      cubeObjects.push({ y: block.y, mesh, edges });
    }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(maxX + 2, .08, maxZ + 2), new THREE.MeshStandardMaterial({ color: 0xe0e8da, roughness: 1 }));
    floor.position.y = -.075;
    buildingGroup.add(floor);
    stage.scene.add(buildingGroup);
    showLayer(null);
    setView('diagonal');
  };
  const renderQuestion = () => {
    container.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('blocks-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (mode === 'count') {
      get('#blocks-question').innerHTML = `<p class="task-description">積み木は、ぜんぶで何個かな？<br>見えないところも考えてみよう。</p><div class="blocks-number-picker" aria-label="積み木の数をえらぶ">${Array.from({ length: 8 }, (_, index) => index + 1).map((value) => `<button type="button" class="button button-soft ${answer === value ? 'blocks-selected' : ''}" data-answer="${value}" aria-pressed="${answer === value}">${value}</button>`).join('')}</div>`;
    } else {
      const { choices, frame } = silhouetteChoices(projectBlocks(current().blocks, questionView), buildingIndex + VIEWS.indexOf(questionView));
      get('#blocks-question').innerHTML = `<p class="task-description">${VIEW_NAMES[questionView]}から見ると、どの形かな？<br>先に予想して、あとで向きを変えよう。</p><div class="blocks-task-view" aria-label="予想する向き">${VIEWS.map((name) => `<button type="button" class="button button-soft ${name === questionView ? 'blocks-selected' : ''}" data-question-view="${name}" aria-pressed="${name === questionView}">${VIEW_NAMES[name]}から</button>`).join('')}</div><div class="blocks-choices">${choices.map((cells, index) => `<button type="button" class="blocks-choice" data-choice="${index}" aria-label="${['ア', 'イ', 'ウ'][index]}の形" aria-pressed="${selectedChoice === index}">${projectionSvg(cells, frame)}<span class="blocks-choice-label">${['ア', 'イ', 'ウ'][index]}</span></button>`).join('')}</div>`;
    }
    get('#blocks-check').textContent = 'たしかめる';
  };
  const renderHint = () => {
    const content = get('#blocks-hint-content');
    content.hidden = !hintOpen;
    get('#blocks-hint-toggle').textContent = hintOpen ? 'ヒントを閉じる' : 'ヒントを見る';
    get('#blocks-hint-toggle').setAttribute('aria-expanded', String(hintOpen));
    if (!hintOpen) { showLayer(null); return; }
    const levels = Math.max(...current().blocks.map((block) => block.y)) + 1;
    content.innerHTML = `<p class="hint">${mode === 'count' ? '１だんずつ見て、数を合わせてみよう。' : '予想する向きから、たしかめてみよう。'}</p>${mode === 'count' ? `<div class="blocks-layer-picker"><button type="button" class="button button-soft" data-layer="all">ぜんぶ</button>${Array.from({ length: levels }, (_, index) => `<button type="button" class="button button-soft" data-layer="${index}">${index + 1}だんめ</button>`).join('')}</div>` : `<button type="button" class="button button-soft" data-hint-view="${questionView}">${VIEW_NAMES[questionView]}から見てみる</button>`}`;
    showLayer(layer);
  };
  const maybeAward = () => {
    const building = current();
    if (solvedCounts.has(building.id) && solvedViews.has(building.id) && !awarded.has(building.id)) {
      awarded.add(building.id);
      context.onComplete(`blocks-${building.id}`, `${building.name}のたんけん`);
      updatePicker();
      return true;
    }
    return false;
  };
  const changeBuilding = (index: number) => {
    buildingIndex = index;
    answer = selectedChoice = null;
    hintOpen = false;
    layer = null;
    get('#blocks-building-name').textContent = current().name;
    updatePicker();
    buildScene();
    renderQuestion();
    renderHint();
    feedback('向きを変えながら、たんけんしてみよう。');
  };

  container.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.building !== undefined) changeBuilding(Number(button.dataset.building));
    else if (button.dataset.camera) setView(button.dataset.camera as View);
    else if (button.dataset.mode) {
      mode = button.dataset.mode as 'count' | 'view';
      answer = selectedChoice = null;
      hintOpen = false;
      showLayer(null);
      if (mode === 'view') setView('diagonal');
      renderQuestion(); renderHint(); feedback('');
    } else if (button.dataset.answer) {
      answer = Number(button.dataset.answer); renderQuestion(); feedback('選べたら「たしかめる」を押そう。');
      get<HTMLButtonElement>(`[data-answer="${answer}"]`).focus();
    } else if (button.dataset.choice !== undefined) {
      selectedChoice = Number(button.dataset.choice); renderQuestion(); feedback('選べたら「たしかめる」を押そう。');
      get<HTMLButtonElement>(`[data-choice="${selectedChoice}"]`).focus();
    } else if (button.dataset.questionView) {
      questionView = button.dataset.questionView as BlockView;
      selectedChoice = null;
      setView('diagonal'); showLayer(null); renderQuestion(); renderHint(); feedback('');
    } else if (button.dataset.layer) showLayer(button.dataset.layer === 'all' ? null : Number(button.dataset.layer));
    else if (button.dataset.hintView) { showLayer(null); setView(questionView); }
    else if (button.id === 'blocks-hint-toggle') { hintOpen = !hintOpen; renderHint(); }
    else if (button.id === 'blocks-check') {
      if (mode === 'count') {
        if (answer === null) { feedback('何個かな？ 数をひとつ選んでね。'); return; }
        if (answer !== countBlocks(current().blocks)) { feedback('もう一度たんけんしよう。１だんずつ見るヒントも使えるよ。'); return; }
        solvedCounts.add(current().id);
        const complete = maybeAward();
        feedback(complete ? 'たんけん成功！ 建物の星をもらったよ。別の建物にも挑戦しよう。' : '正解！ 見えない積み木も数えられたね。「② 見え方を予想」にも挑戦しよう。', true);
        showLayer(null);
      } else {
        if (selectedChoice === null) { feedback('どの形かな？ ア・イ・ウから選んでね。'); return; }
        const correct = silhouetteChoices(projectBlocks(current().blocks, questionView), buildingIndex + VIEWS.indexOf(questionView)).correctIndex;
        if (selectedChoice !== correct) { feedback('向きを変えて、積み木の重なりを見てみよう。もう一度選べるよ。'); return; }
        solvedViews.add(current().id);
        const complete = maybeAward();
        feedback(complete ? 'たんけん成功！ 建物の星をもらったよ。別の向きでも予想してみよう。' : '正解！ 向きを変えると、重なって見える積み木が変わるね。', true);
        showLayer(null); setView(questionView);
      }
    }
  }, { signal: abort.signal });
  changeBuilding(0);
  return () => { abort.abort(); stage?.dispose(); container.replaceChildren(); };
}
