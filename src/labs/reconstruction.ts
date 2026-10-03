import type { GameContext } from '../types';
import type { Block, BlockView, ProjectedCell } from '../geometry/blocks';
import { columnHeight, editColumn, type ColumnAction } from '../geometry/construction';
import { RECONSTRUCTION_TASKS, RECONSTRUCTION_VIEWS, validateReconstruction } from '../geometry/reconstruction';
import { createBlockScene, type ConstructionView } from '../shared/block-scene';
import './reconstruction.css';

const VIEW_NAMES: Record<ConstructionView, string> = { diagonal: 'ななめ', front: '前', side: '右よこ', top: '上' };
const drafts = new Map<string, Block[]>();
const clone = (blocks: readonly Block[]): Block[] => blocks.map((block) => ({ ...block }));

/** Static 3 × 3 frame. Keep the origin instead of centering each silhouette. */
function projectionSvg(cells: readonly ProjectedCell[], view: BlockView): string {
  const keys = new Set(cells.map(({ u, v }) => `${u},${v}`));
  const minU = view === 'side' ? -2 : 0;
  const maxV = view === 'top' ? 0 : 2;
  const squares = Array.from({ length: 9 }, (_, index) => {
    const col = index % 3, row = Math.floor(index / 3);
    const selected = keys.has(`${minU + col},${maxV - row}`);
    return `<rect x="${18 + col * 26}" y="${12 + row * 26}" width="26" height="26" fill="${selected ? '#89b5d1' : '#f9f6ed'}" stroke="${selected ? '#294f49' : '#d4ded0'}" stroke-width="${selected ? 1.4 : .9}"/>`;
  }).join('');
  const captions = view === 'top' ? '↓ テマエ' : view === 'side' ? '← テマエ' : 'マエ';
  const marker = view === 'top' ? '<text x="24" y="25" fill="#71541f" font-size="11">★</text>' : '';
  const numbers = [0, 1, 2].map((col) => `<text x="${31 + col * 26}" y="${view === 'top' ? 105 : 106}" text-anchor="middle" fill="#748d80" font-size="10">${view === 'side' ? 2 - col : col}</text>`).join('');
  return `<svg viewBox="0 0 114 127" aria-hidden="true">${squares}${marker}${numbers}<text x="57" y="122" text-anchor="middle" fill="#647f70" font-size="9">${captions}</text></svg>`;
}

function describeProjection(cells: readonly ProjectedCell[], view: BlockView): string {
  return `${VIEW_NAMES[view]}から見た図。ぬられたマスは、${cells.map(({ u, v }) => view === 'top'
    ? `左から${u + 1}ばんめ、奥から${1 - v}ばんめ`
    : `左から${view === 'side' ? u + 3 : u + 1}ばんめ、下から${v + 1}だんめ`).join('。')}。`;
}

export function mountReconstruction(container: HTMLElement, context: GameContext): () => void {
  let taskIndex = 0;
  let blocks: Block[] = [];
  let history: Block[][] = [];
  let action: ColumnAction = 'add';
  let view: ConstructionView = 'diagonal';
  let hintOpen = false;
  const awarded = new Set<string>();
  const abort = new AbortController();
  const current = () => RECONSTRUCTION_TASKS[taskIndex];

  container.innerHTML = `<div class="reconstruction-missions" aria-label="図の問題をえらぶ"></div>
    <section class="panel reconstruction-intro">
      <p class="task-kicker">みる → つくる → たしかめる</p><h2 class="task-title"></h2><p class="task-description"></p>
      <p class="small-text">上の図と場所のボタンは、同じ向き。★のマスは左上だよ。ぬられたマスの形を見くらべよう。</p>
      <div class="reconstruction-projections"></div>
      <p class="small-text">手前のブロックに重なって、見えないところもあるよ。同じ３つの図になる建物が、いくつもあることがあるよ。</p>
    </section>
    <section class="lab-stage reconstruction-stage">
      <div class="stage-workspace reconstruction-workspace">
        <div class="reconstruction-world"><h3>あなたの建物 <span id="reconstruction-count"></span></h3><div class="canvas-host reconstruction-scene" id="reconstruction-mine" role="img" aria-label="あなたが作っている建物"></div><p class="small-text reconstruction-front"><span>●</span> 手前の線</p></div>
        <aside class="stage-controller reconstruction-controller" aria-label="図から建物を作る操作">
          <h3>見る向き</h3><div class="reconstruction-views">${(Object.keys(VIEW_NAMES) as ConstructionView[]).map((name) => `<button type="button" class="button button-soft" data-reconstruction-view="${name}" aria-pressed="${name === view}">${VIEW_NAMES[name]}</button>`).join('')}</div>
          <h3>どうする？</h3><div class="reconstruction-actions"><button type="button" class="button button-soft" data-reconstruction-action="add" aria-pressed="true">＋ つむ</button><button type="button" class="button button-soft" data-reconstruction-action="remove" aria-pressed="false">− とる</button></div>
          <p class="small-text">場所をえらぼう。数字は、そのマスの高さだよ。</p><div class="reconstruction-grid" aria-label="上から見た９つの場所"></div><p class="small-text reconstruction-grid-front">↓ 手前</p>
          <div class="reconstruction-actions"><button type="button" class="button button-soft" id="reconstruction-undo">もどす</button><button type="button" class="button button-soft" id="reconstruction-clear">やりなおす</button></div>
          <button type="button" class="button button-primary" id="reconstruction-check">図とくらべる</button>
          <button type="button" class="button button-soft" id="reconstruction-hint" aria-expanded="false">ヒント</button><p class="small-text reconstruction-hint" id="reconstruction-hint-copy" hidden></p>
          <button type="button" class="button button-soft" id="reconstruction-next" hidden>つぎの図へ</button>
        </aside>
      </div>
      <div class="reconstruction-result"><p class="feedback" id="reconstruction-feedback" role="status" aria-live="polite" aria-atomic="true"></p><p class="small-text">つづきは、この画面を閉じるまでは覚えているよ。</p></div>
    </section>`;

  const get = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const scene = createBlockScene(get('#reconstruction-mine'));
  const say = (message: string, success = false) => {
    get('#reconstruction-feedback').textContent = message;
    get('#reconstruction-feedback').classList.toggle('success', success);
    context.onNarrate?.(message);
  };
  const remember = () => drafts.set(current().id, clone(blocks));
  const clearProjectionStatus = () => {
    container.querySelectorAll<HTMLElement>('[data-reconstruction-projection]').forEach((card) => {
      card.classList.remove('is-match', 'is-mismatch');
      card.querySelector<HTMLElement>('[data-projection-status]')!.textContent = 'この形にしよう';
    });
    get('#reconstruction-next').hidden = true;
  };
  const renderModel = () => {
    scene.setBlocks(blocks);
    get('#reconstruction-count').textContent = `／ ${blocks.length}こ`;
    get('#reconstruction-mine').setAttribute('aria-label', `あなたの建物。${blocks.length}このブロック。${VIEW_NAMES[view]}から見ています。`);
    get<HTMLButtonElement>('#reconstruction-undo').disabled = history.length === 0;
    get<HTMLButtonElement>('#reconstruction-clear').disabled = blocks.length === 0;
    const grid = get('.reconstruction-grid');
    if (!grid.children.length) grid.innerHTML = Array.from({ length: 9 }, (_, index) => `<button type="button" class="button reconstruction-cell ${index === 0 ? 'reconstruction-origin' : ''}" data-reconstruction-column="${index}"><span>${index === 0 ? '★' : '·'}</span><strong>0</strong></button>`).join('');
    Array.from(grid.children).forEach((node, index) => {
      const button = node as HTMLButtonElement;
      const x = index % 3, z = Math.floor(index / 3), height = columnHeight(blocks, x, z);
      button.querySelector('strong')!.textContent = String(height);
      button.setAttribute('aria-label', `${['奥', 'まんなか', '手前'][z]}の${['左', 'まんなか', '右'][x]}、高さ${height}。${action === 'add' ? 'ひとつ積む' : 'いちばん上を取る'}`);
    });
  };
  const renderPicker = () => {
    get('.reconstruction-missions').innerHTML = RECONSTRUCTION_TASKS.map((task, index) => `<button type="button" class="button button-soft" data-reconstruction-task="${index}" aria-pressed="${index === taskIndex}">${index + 1}. ${task.label}${awarded.has(task.id) ? ' ✓' : ''}</button>`).join('');
  };
  const loadTask = (index: number) => {
    taskIndex = index;
    blocks = clone(drafts.get(current().id) ?? []);
    history = [];
    action = 'add';
    hintOpen = false;
    view = 'diagonal';
    get('.task-title').textContent = current().label;
    get('.task-description').textContent = current().description;
    get('#reconstruction-hint-copy').textContent = current().hint;
    get('#reconstruction-hint-copy').hidden = true;
    get('#reconstruction-hint').setAttribute('aria-expanded', 'false');
    get('.reconstruction-projections').innerHTML = RECONSTRUCTION_VIEWS.map((direction) => `<section class="reconstruction-projection" data-reconstruction-projection="${direction}"><h3>${VIEW_NAMES[direction]}から</h3><div role="img" aria-label="${describeProjection(current().projections[direction], direction)}">${projectionSvg(current().projections[direction], direction)}</div><p class="small-text" data-projection-status>この形にしよう</p></section>`).join('');
    container.querySelectorAll<HTMLElement>('[data-reconstruction-action]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.reconstructionAction === action)));
    container.querySelectorAll<HTMLElement>('[data-reconstruction-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.reconstructionView === view)));
    scene.setView(view);
    renderPicker(); renderModel(); clearProjectionStatus();
    say(`${current().label}。${current().description}`);
  };
  const edit = (index: number) => {
    const next = editColumn(blocks, index % 3, Math.floor(index / 3), action);
    if (next.length === blocks.length) { say(action === 'add' ? '３だんまで積めるよ。別の場所も考えよう。' : 'この場所にはブロックがないよ。'); return; }
    history.push(clone(blocks)); if (history.length > 60) history.shift();
    blocks = next;
    renderModel(); remember(); clearProjectionStatus();
    say(action === 'add' ? 'ひとつ積んだよ。３つの図を見くらべよう。' : 'いちばん上を取ったよ。３つの図を見くらべよう。');
  };
  const check = () => {
    const result = validateReconstruction(blocks, current());
    for (const direction of RECONSTRUCTION_VIEWS) {
      const card = get(`[data-reconstruction-projection="${direction}"]`);
      const matches = result.views[direction].matches;
      card.classList.toggle('is-match', matches);
      card.classList.toggle('is-mismatch', !matches);
      card.querySelector<HTMLElement>('[data-projection-status]')!.textContent = matches ? '形が合った！' : 'もうすこし！';
    }
    if (!result.valid) { say('まずは、場所をえらんでブロックを積もう。下からつくると、しっかりした建物になるよ。'); return; }
    if (!result.matches) {
      const wrongViews = RECONSTRUCTION_VIEWS.filter((direction) => !result.views[direction].matches);
      say(`${wrongViews.map((direction) => VIEW_NAMES[direction]).join('・')}の図がまだちがうよ。見る向きを変えて、形を見くらべよう。`);
      return;
    }
    if (!awarded.has(current().id)) {
      awarded.add(current().id);
      context.onComplete(`reconstruction-${current().id}`, `${current().label}を図からつくった`);
      renderPicker();
    }
    get('#reconstruction-next').hidden = taskIndex === RECONSTRUCTION_TASKS.length - 1;
    say('できた！ ３つの図と同じ見え方だね。こたえは、ひとつとはかぎらないよ。', true);
  };

  container.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.reconstructionColumn !== undefined) edit(Number(button.dataset.reconstructionColumn));
    else if (button.dataset.reconstructionAction) {
      action = button.dataset.reconstructionAction as ColumnAction;
      container.querySelectorAll<HTMLElement>('[data-reconstruction-action]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.reconstructionAction === action)));
      renderModel(); say(action === 'add' ? '場所をえらぶと、ひとつ積むよ。' : '場所をえらぶと、いちばん上を取るよ。');
    } else if (button.dataset.reconstructionView) {
      view = button.dataset.reconstructionView as ConstructionView;
      scene.setView(view); renderModel();
      container.querySelectorAll<HTMLElement>('[data-reconstruction-view]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.reconstructionView === view)));
      say(`${VIEW_NAMES[view]}から見た形と、図を見くらべよう。`);
    } else if (button.dataset.reconstructionTask !== undefined) loadTask(Number(button.dataset.reconstructionTask));
    else if (button.id === 'reconstruction-undo') {
      blocks = history.pop() ?? blocks; renderModel(); remember(); clearProjectionStatus(); say('ひとつ前にもどしたよ。');
    } else if (button.id === 'reconstruction-clear') {
      history.push(clone(blocks)); blocks = []; renderModel(); remember(); clearProjectionStatus(); say('からっぽにしたよ。「もどす」で戻せるよ。');
    } else if (button.id === 'reconstruction-check') check();
    else if (button.id === 'reconstruction-next') loadTask(taskIndex + 1);
    else if (button.id === 'reconstruction-hint') {
      hintOpen = !hintOpen; get('#reconstruction-hint-copy').hidden = !hintOpen; button.setAttribute('aria-expanded', String(hintOpen));
      if (hintOpen) context.onNarrate?.(current().hint);
    }
  }, { signal: abort.signal });
  loadTask(0);
  return () => { remember(); abort.abort(); scene.dispose(); container.replaceChildren(); };
}
