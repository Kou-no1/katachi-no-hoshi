import { BUILDINGS, blocksInLayer, type Block } from '../geometry/blocks';
import { columnHeight, editColumn, matchConstruction, type ColumnAction } from '../geometry/construction';
import { createBlockScene, type ConstructionView } from '../shared/block-scene';
import { baseText } from '../shared/furigana';
import { readWorkshop, saveWorkshop } from '../workshop-storage';
import type { GameContext } from '../types';
import './construction.css';

export interface ConstructionOptions { mode: 'copy' | 'free'; task?: number; initial?: readonly Block[]; onGallery: () => void; }
const VIEW_NAMES: Record<ConstructionView, string> = { diagonal: 'ななめ', front: '前', side: '右よこ', top: '上' };
const clone = (blocks: readonly Block[]) => blocks.map(block => ({ ...block }));

export function mountConstruction(container: HTMLElement, context: GameContext, options: ConstructionOptions): () => void {
  let task = options.task ?? 0;
  let blocks: Block[] = [];
  let history: Block[][] = [];
  let action: ColumnAction = 'add';
  let view: ConstructionView = 'diagonal';
  let layer: number | null = null;
  let hintOpen = false;
  let hintColumn: { x: number; z: number } | null = null;
  const abort = new AbortController();
  const isCopy = options.mode === 'copy';
  const current = () => BUILDINGS[task];
  const saveId = () => isCopy ? current().id : 'free';

  container.innerHTML = `
    <div class="construction-missions" aria-label="作る見本をえらぶ" ${isCopy ? '' : 'hidden'}></div>
    <section class="panel construction-intro"><p class="task-kicker">${isCopy ? 'みる → つくる → くらべる' : 'じぶんだけの たてもの'}</p><h2 class="task-title"></h2><p class="task-description"></p><p class="small-text">★のマスと黄色の丸を目じるしにしよう。場所のボタンは、いつも上から見た向きだよ。</p><p class="small-text" id="construction-layer-status" hidden></p></section>
    <section class="lab-stage construction-stage">
      <div class="stage-workspace construction-workspace">
        <div class="construction-worlds ${isCopy ? '' : 'construction-worlds-free'}">
          ${isCopy ? '<section class="construction-world"><h3>見本</h3><div class="canvas-host construction-scene" id="construction-target" role="img" aria-label="同じ場所と高さに作る見本"></div><p class="small-text construction-front"><span>●</span> 手前の線</p></section>' : ''}
          <section class="construction-world"><h3>あなたの建物 <span id="construction-count"></span></h3><div class="canvas-host construction-scene" id="construction-mine" role="img" aria-label="あなたが作っている建物"></div><p class="small-text construction-front"><span>●</span> 手前の線</p></section>
        </div>
        <aside class="stage-controller construction-controller" aria-label="建物を作る操作">
          <h3>見る向き</h3><div class="construction-views">${(Object.keys(VIEW_NAMES) as ConstructionView[]).map(v => `<button type="button" class="button button-soft" data-construction-view="${v}" aria-pressed="${v === view}">${VIEW_NAMES[v]}</button>`).join('')}</div>
          <h3>どうする？</h3><div class="construction-actions"><button type="button" class="button button-soft" data-column-action="add" aria-pressed="true">＋ つむ</button><button type="button" class="button button-soft" data-column-action="remove" aria-pressed="false">− とる</button></div>
          <p class="small-text">場所をえらぼう。数字は、そのマスの高さだよ。</p>
          <div class="construction-grid" aria-label="上から見た９つの場所"></div><p class="small-text construction-grid-front">↓ 手前</p>
          <div class="construction-actions"><button type="button" class="button button-soft" id="construction-undo" aria-label="ひとつ前に戻す">もどす</button><button type="button" class="button button-soft" id="construction-clear">やりなおす</button></div>
          <button type="button" class="button button-primary" id="construction-check">${isCopy ? '見本とくらべる' : 'きちに飾る'}</button>
          ${isCopy ? '<button type="button" class="button button-soft" id="construction-hint" aria-expanded="false">ヒント</button><div id="construction-hints" hidden><p class="small-text">下のだんから、つくろう。</p><div class="construction-layers"><button type="button" class="button button-soft" data-construction-layer="all">ぜんぶ</button><button type="button" class="button button-soft" data-construction-layer="0">１だんめ</button><button type="button" class="button button-soft" data-construction-layer="1">２だんめ</button></div><button type="button" class="button button-soft" id="construction-one-hint">１マスのヒント</button><p class="small-text" id="construction-hint-copy"></p></div>' : ''}
        </aside>
      </div>
      <div class="construction-result"><p class="feedback" id="construction-feedback" role="status" aria-live="polite" aria-atomic="true"></p><div class="button-row"><button type="button" class="button button-primary" id="construction-next" hidden>つぎの見本へ</button><button type="button" class="button button-soft" id="construction-gallery">わたしの基地を見る</button></div><p class="small-text" id="construction-save-state"></p></div>
    </section>`;
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const mine = createBlockScene(get('#construction-mine'));
  const target = isCopy ? createBlockScene(get('#construction-target')) : null;
  function feedback(message: string, success = false) {
    get('#construction-feedback').textContent = message;
    get('#construction-feedback').classList.toggle('success', success);
  }
  function renderScenes() {
    mine.setBlocks(layer === null ? blocks : blocksInLayer(blocks, layer));
    target?.setBlocks(layer === null ? current().blocks : blocksInLayer(current().blocks, layer));
    get('#construction-mine').setAttribute('aria-label', `あなたの建物。${blocks.length}このブロック。${VIEW_NAMES[view]}から${layer === null ? '' : `、${layer + 1}だんめだけ`}見ています。`);
    get('#construction-count').textContent = `／ ${blocks.length}こ`;
    get('#construction-layer-status').hidden = layer === null;
    get('#construction-layer-status').textContent = layer === null ? '' : `いまは、${layer + 1}だんめだけを見ているよ。`;
    get('#construction-undo').toggleAttribute('disabled', history.length === 0);
    get('#construction-clear').toggleAttribute('disabled', blocks.length === 0);
    get('#construction-next').hidden = true;
    const cells = get('.construction-grid');
    if (!cells.children.length) {
      cells.innerHTML = Array.from({ length: 9 }, (_, index) => `<button type="button" class="button construction-cell ${index === 0 ? 'construction-origin' : ''}" data-column="${index}"><span>${index === 0 ? '★' : '·'}</span><strong></strong></button>`).join('');
    }
    Array.from(cells.children).forEach((node, index) => {
      const button = node as HTMLButtonElement;
      const x = index % 3, z = Math.floor(index / 3), height = columnHeight(blocks, x, z);
      button.querySelector('strong')!.textContent = String(height);
      button.classList.toggle('construction-hint-cell', hintColumn?.x === x && hintColumn?.z === z);
      button.setAttribute('aria-label', `${['奥', 'まんなか', '手前'][z]}の${['左', 'まんなか', '右'][x]}、高さ${height}。${action === 'add' ? 'ひとつ積む' : 'いちばん上を取る'}`);
    });
  }
  function remember() {
    const save = readWorkshop();
    save.drafts[saveId()] = clone(blocks);
    const saved = saveWorkshop(save);
    get('#construction-save-state').textContent = saved ? 'つづきは、このブラウザに保存するよ。' : 'この画面を閉じるまでは、つづけて遊べるよ。';
  }
  function resetHints() {
    layer = null; hintColumn = null; hintOpen = false;
    if (isCopy) {
      get('#construction-hints').hidden = true; get('#construction-hint').setAttribute('aria-expanded', 'false'); get('#construction-hint-copy').textContent = '';
      container.querySelectorAll<HTMLElement>('[data-construction-layer]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.constructionLayer === 'all')));
    }
  }
  function loadTask(index: number, initial?: readonly Block[]) {
    task = index;
    action = 'add';
    container.querySelectorAll<HTMLElement>('[data-column-action]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.columnAction === action)));
    blocks = clone(initial ?? readWorkshop().drafts[saveId()] ?? []);
    history = []; resetHints();
    get('.task-title').textContent = isCopy ? current().name : 'すきな建物をつくろう';
    get('.task-description').textContent = isCopy ? '見本と同じ場所・高さに、ブロックを積もう。見本をいろんな向きから見て、下のだんから考えよう。' : 'どんな建物にしよう？ ３だんまで積めるよ。できたら、きちに飾ろう。';
    if (isCopy) {
      const creations = readWorkshop().creations;
      get('.construction-missions').innerHTML = BUILDINGS.map((building, i) => `<button type="button" class="button button-soft" data-construction-task="${i}" aria-pressed="${i === task}">${i + 1}. ${building.name}${creations[building.id] ? ' ✓' : ''}</button>`).join('');
    }
    renderScenes(); feedback('どこからつくる？ 下のだんを見てみよう。');
    context.onNarrate?.(`${baseText(get('.task-title'))}。${baseText(get('.task-description'))}`);
  }
  function edit(x: number, z: number) {
    const next = editColumn(blocks, x, z, action);
    if (next.length === blocks.length) { feedback(action === 'add' ? '３だんまで積めるよ。別の場所も使ってみよう。' : 'この場所には、ブロックがないよ。'); return; }
    history.push(clone(blocks)); if (history.length > 60) history.shift();
    blocks = next; hintColumn = null;
    if (isCopy) get('#construction-hint-copy').textContent = '';
    renderScenes(); remember(); feedback(action === 'add' ? 'ひとつ積んだよ。つぎはどこにしよう？' : 'いちばん上を取ったよ。つづけて作ろう。');
  }
  function check() {
    if (!blocks.length) { feedback('まずは、場所をえらんでブロックを積んでみよう。'); return; }
    if (isCopy && !matchConstruction(blocks, current().blocks).matches) {
      feedback('もうすこし！ ★を目じるしに、場所と高さをくらべよう。向きを変えたり、ヒントを使ったりしてみよう。'); return;
    }
    resetHints(); renderScenes();
    const save = readWorkshop(); save.creations[saveId()] = clone(blocks); save.drafts[saveId()] = clone(blocks);
    const saved = saveWorkshop(save);
    if (isCopy) {
      context.onComplete(`blocks-build-${current().id}`, `${current().name}をつくった`);
      get<HTMLButtonElement>(`[data-construction-task="${task}"]`).textContent = `${task + 1}. ${current().name} ✓`;
      get('#construction-next').hidden = task >= BUILDINGS.length - 1;
    }
    feedback(isCopy ? 'できた！ 場所も高さも同じだね。きちに建物を飾ったよ。' : 'できた！ あなたの建物を、きちに飾ったよ。いつでも作り直せるよ。', true);
    get('#construction-save-state').textContent = saved ? 'きちの建物は、このブラウザに保存したよ。' : 'この画面を閉じるまでは、きちで建物を見られるよ。';
  }
  container.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.column !== undefined) { const index = Number(button.dataset.column); edit(index % 3, Math.floor(index / 3)); }
    else if (button.dataset.columnAction) {
      action = button.dataset.columnAction as ColumnAction;
      container.querySelectorAll<HTMLElement>('[data-column-action]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.columnAction === action)));
      renderScenes(); feedback(action === 'add' ? '場所をえらぶと、ひとつ積むよ。' : '場所をえらぶと、いちばん上を取るよ。');
    } else if (button.dataset.constructionView) {
      view = button.dataset.constructionView as ConstructionView; mine.setView(view); target?.setView(view);
      container.querySelectorAll<HTMLElement>('[data-construction-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.constructionView === view)));
      get('#construction-mine').setAttribute('aria-label', `あなたの建物。${blocks.length}このブロック。${VIEW_NAMES[view]}から見ています。`);
    } else if (button.dataset.constructionTask !== undefined) loadTask(Number(button.dataset.constructionTask));
    else if (button.dataset.constructionLayer) {
      layer = button.dataset.constructionLayer === 'all' ? null : Number(button.dataset.constructionLayer); renderScenes();
      container.querySelectorAll<HTMLElement>('[data-construction-layer]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.constructionLayer === String(layer ?? 'all'))));
    } else if (button.id === 'construction-undo') {
      blocks = history.pop() ?? blocks; hintColumn = null; renderScenes(); remember(); feedback('ひとつ前にもどしたよ。');
    } else if (button.id === 'construction-clear') {
      history.push(clone(blocks)); blocks = []; resetHints(); renderScenes(); remember(); feedback('からっぽにしたよ。「もどす」で戻せるよ。');
    } else if (button.id === 'construction-check') check();
    else if (button.id === 'construction-next') loadTask(task + 1);
    else if (button.id === 'construction-gallery') options.onGallery();
    else if (button.id === 'construction-hint') {
      hintOpen = !hintOpen; get('#construction-hints').hidden = !hintOpen; button.setAttribute('aria-expanded', String(hintOpen));
      if (!hintOpen) { resetHints(); renderScenes(); }
    } else if (button.id === 'construction-one-hint') {
      hintColumn = null;
      for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) {
        if (!hintColumn && columnHeight(blocks, x, z) !== columnHeight(current().blocks, x, z)) hintColumn = { x, z };
      }
      get('#construction-hint-copy').textContent = hintColumn ? (columnHeight(current().blocks, hintColumn.x, hintColumn.z) ? `ひかるマスは、${columnHeight(current().blocks, hintColumn.x, hintColumn.z)}こ積むよ。` : 'ひかるマスは、からっぽにしよう。') : '場所と高さがそろったね。「見本とくらべる」でたしかめよう。';
      renderScenes();
    }
  }, { signal: abort.signal });
  loadTask(task, options.initial);
  return () => { abort.abort(); mine.dispose(); target?.dispose(); container.replaceChildren(); };
}
