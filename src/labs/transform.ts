import type { GameContext } from '../types';
import {
  AREA_CHALLENGES, cellKey, polygonArea, REFLECTION_CHALLENGES, reflectGridCell,
  sameCells, samePolygon, scalePolygon, SCALING_CHALLENGES,
} from '../geometry/transform';
import type { GridCell, Point, TransformMode } from '../geometry/transform';
import './transform.css';

const MODES: TransformMode[] = ['symmetry', 'scale', 'area'];
const MODE_LABELS: Record<TransformMode, string> = { symmetry: '対称', scale: '拡大縮小', area: '面積' };
const factorText = (factor: number) => factor === 0.5 ? '1/2' : String(factor);
const pointsAttribute = (points: Point[], origin: Point, unit: number) =>
  points.map((point) => `${origin.x + point.x * unit},${origin.y - point.y * unit}`).join(' ');

function gridLines(columns: number, rows: number, origin: Point, unit: number): string {
  const vertical = Array.from({ length: columns + 1 }, (_, index) =>
    `<path d="M ${origin.x + index * unit} ${origin.y} v ${-rows * unit}"/>`).join('');
  const horizontal = Array.from({ length: rows + 1 }, (_, index) =>
    `<path d="M ${origin.x} ${origin.y - index * unit} h ${columns * unit}"/>`).join('');
  return `<g class="transform-grid-lines">${vertical}${horizontal}</g>`;
}

export function mountTransform(container: HTMLElement, context: GameContext): () => void {
  const events = new AbortController();
  const earned = new Set<string>();
  let mode: TransformMode = 'symmetry';
  let challengeIndex = 0;
  let selectedCells = new Set<string>();
  let factor = 1;
  let answer = '';
  let helperOpen = false;
  let hintOpen = false;
  let lastFeedback = '';
  let lastSuccess = false;

  container.innerHTML = `
    <div class="lab-layout transform-lab">
      <section class="lab-stage">
        <div class="stage-toolbar"><span class="badge">図形の設計室</span><span class="small-text">予想 → 操作 → 発見</span></div>
        <div class="transform-mode-nav" aria-label="学ぶことを選ぶ">
          <button class="button button-soft" data-transform-mode="symmetry" aria-pressed="true">対称</button>
          <button class="button button-soft" data-transform-mode="scale" aria-pressed="false">拡大縮小</button>
          <button class="button button-soft" data-transform-mode="area" aria-pressed="false">面積</button>
        </div>
        <div class="stage-workspace transform-workspace">
          <div class="canvas-host transform-canvas" data-transform-canvas></div>
          <div class="stage-controller transform-controller">
            <h3 class="panel-title" data-control-title></h3>
            <div data-controller-body></div>
            <button class="button button-primary transform-check" data-transform-action="check">たしかめる</button>
          </div>
        </div>
        <p class="stage-caption" data-caption></p>
      </section>
      <aside class="lab-sidebar">
        <div class="panel">
          <p class="task-kicker" data-task-count></p>
          <h2 class="task-title" data-task-title></h2>
          <p class="task-description" data-task-description></p>
          <div class="button-row transform-task-nav">
            <button class="button button-soft" data-transform-action="previous">前の課題</button>
            <button class="button button-soft" data-transform-action="next">つぎの課題 →</button>
          </div>
        </div>
        <div class="panel">
          <h3 class="panel-title">ためしてみよう</h3>
          <p class="feedback transform-feedback" role="status" aria-live="polite" aria-atomic="true" data-feedback></p>
          <p class="transform-discovery" data-discovery hidden></p>
          <div class="button-row">
            <button class="button button-soft" data-transform-action="hint" aria-expanded="false">ヒント</button>
            <button class="button button-soft" data-transform-action="reset">はじめから</button>
            <button class="button button-soft" data-transform-action="narrate">よみあげ</button>
          </div>
          <p class="hint transform-hint" data-hint hidden></p>
        </div>
      </aside>
    </div>`;

  const canvas = container.querySelector<HTMLElement>('[data-transform-canvas]')!;
  const controls = container.querySelector<HTMLElement>('[data-controller-body]')!;
  const controlTitle = container.querySelector<HTMLElement>('[data-control-title]')!;
  const feedback = container.querySelector<HTMLElement>('[data-feedback]')!;
  const discovery = container.querySelector<HTMLElement>('[data-discovery]')!;
  const hint = container.querySelector<HTMLElement>('[data-hint]')!;
  const hintButton = container.querySelector<HTMLButtonElement>('[data-transform-action="hint"]')!;
  const previousButton = container.querySelector<HTMLButtonElement>('[data-transform-action="previous"]')!;
  const taskTitle = container.querySelector<HTMLElement>('[data-task-title]')!;
  const taskDescription = container.querySelector<HTMLElement>('[data-task-description]')!;
  if (!context.onNarrate) container.querySelector<HTMLButtonElement>('[data-transform-action="narrate"]')!.hidden = true;

  function currentChallenge() {
    return mode === 'symmetry' ? REFLECTION_CHALLENGES[challengeIndex]
      : mode === 'scale' ? SCALING_CHALLENGES[challengeIndex] : AREA_CHALLENGES[challengeIndex];
  }

  function say(text: string, success = false): void {
    lastFeedback = text;
    lastSuccess = success;
    feedback.textContent = text;
    feedback.classList.toggle('success', success);
    if (!success) discovery.hidden = true;
  }

  function cellLabel(column: number, row: number, filled: boolean): string {
    return `右の${column === 2 ? '線に近い' : '線から遠い'}列、上から${row + 1}番目。${filled ? '色あり' : '色なし'}。押すと色を切り替えます。`;
  }

  function symmetryScene(): string {
    const source = new Set(REFLECTION_CHALLENGES[challengeIndex].source.map(cellKey));
    const cells: string[] = [];
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        const sourceCell = column < 2;
        const colored = sourceCell && source.has(`${column},${row}`);
        cells.push(`<rect x="${4 + column * 44}" y="${42 + row * 44}" width="44" height="44" fill="${colored ? '#f19b79' : '#fffdf8'}" stroke="#b9cbbf" stroke-width="1.5" ${sourceCell
          ? 'class="transform-source-cell"'
          : `data-transform-cell="${column},${row}" class="transform-edit-cell" role="button" tabindex="0" aria-pressed="false" aria-label="${cellLabel(column, row, false)}"`}/>`);
      }
    }
    return `<svg class="transform-board transform-symmetry-board" viewBox="0 0 184 240" role="group" aria-label="中央の縦線を軸にした左右対称の盤面。右の８マスを操作します。矢印で移動、スペースかEnterで色を切り替えます。" data-transform-board>
      <text x="48" y="25" class="transform-svg-label" text-anchor="middle">もと</text>
      <text x="136" y="25" class="transform-svg-label" text-anchor="middle">つくる</text>
      ${cells.join('')}
      <path d="M92 34 V226" class="transform-mirror-axis"/>
    </svg>`;
  }

  function scalingScene(): string {
    const challenge = SCALING_CHALLENGES[challengeIndex];
    const target = scalePolygon(challenge.source, challenge.targetFactor);
    return `<svg class="transform-board transform-scale-board" viewBox="0 0 320 420" role="group" tabindex="0" aria-label="上がもとの図形。下の点線が見本、緑が操作中の図形です。左右の矢印キーで倍率を変更できます。" data-transform-board>
      <text x="160" y="30" text-anchor="middle" class="transform-svg-label">もと</text>
      <polygon points="${pointsAttribute(challenge.source, { x: 36, y: 148 }, 26)}" fill="#f19b79" class="transform-polygon"/>
      ${gridLines(9, 4, { x: 36, y: 148 }, 26)}
      <text x="160" y="198" text-anchor="middle" class="transform-svg-label">めざす</text>
      <polygon data-transform-scaled points="${pointsAttribute(challenge.source, { x: 36, y: 382 }, 26)}" fill="#81b8a2" class="transform-polygon"/>
      ${gridLines(9, 6, { x: 36, y: 382 }, 26)}
      <polygon points="${pointsAttribute(target, { x: 36, y: 382 }, 26)}" fill="none" stroke="#9e8050" stroke-width="3" stroke-dasharray="6 4" stroke-linejoin="round"/>
    </svg>`;
  }

  function areaScene(): string {
    const challenge = AREA_CHALLENGES[challengeIndex];
    const width = Math.max(...challenge.polygon.map((point) => point.x));
    const height = Math.max(...challenge.polygon.map((point) => point.y));
    const unit = 46;
    const origin = { x: (320 - width * unit) / 2, y: 224 };
    return `<svg class="transform-board transform-area-board" viewBox="0 0 320 360" role="img" aria-label="${challenge.kind === 'count' ? '１マス１平方センチメートルの色のついた図形。' : `横${width}センチメートル、高さ${height}センチメートルの${challenge.kind === 'triangle' ? '三角形' : '長方形'}。`}" data-transform-board>
      <g data-area-helper ${challenge.kind === 'count' ? '' : 'visibility="hidden"'}>
        ${challenge.kind === 'triangle'
          ? `<polygon points="${pointsAttribute([{ x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }], origin, unit)}" fill="#e7cf91" fill-opacity=".45" stroke="#a48c57" stroke-width="2" stroke-dasharray="5 4"/>`
          : ''}
      </g>
      <polygon points="${pointsAttribute(challenge.polygon, origin, unit)}" fill="#81b8a2" class="transform-polygon"/>
      <g data-area-grid ${challenge.kind === 'count' ? '' : 'visibility="hidden"'}>${gridLines(width, height, origin, unit)}</g>
      ${challenge.kind === 'count' ? '' : `
        <path d="M${origin.x} 246 H${origin.x + width * unit}" class="transform-measure"/>
        <text x="160" y="270" text-anchor="middle" class="transform-svg-label">${width} cm</text>
        <path d="M${origin.x - 16} ${origin.y} V${origin.y - height * unit}" class="transform-measure"/>
        <text x="${origin.x - 25}" y="${origin.y - height * unit / 2}" text-anchor="middle" transform="rotate(-90 ${origin.x - 25} ${origin.y - height * unit / 2})" class="transform-svg-label">${height} cm</text>`}
      <rect x="96" y="303" width="46" height="46" fill="#f19b79" stroke="#294f49" stroke-width="1.5"/>
      <text x="158" y="332" class="transform-svg-unit">1 cm²</text>
    </svg>`;
  }

  function renderSymmetry(): void {
    canvas.querySelectorAll<SVGRectElement>('[data-transform-cell]').forEach((cell) => {
      const key = cell.dataset.transformCell!;
      const [column, row] = key.split(',').map(Number);
      const filled = selectedCells.has(key);
      cell.setAttribute('fill', filled ? '#81b8a2' : '#fffdf8');
      cell.setAttribute('aria-pressed', String(filled));
      cell.setAttribute('aria-label', cellLabel(column, row, filled));
    });
  }

  function renderScaling(): void {
    const challenge = SCALING_CHALLENGES[challengeIndex];
    canvas.querySelector<SVGPolygonElement>('[data-transform-scaled]')!.setAttribute('points',
      pointsAttribute(scalePolygon(challenge.source, factor), { x: 36, y: 382 }, 26));
    controls.querySelectorAll<HTMLButtonElement>('[data-transform-factor]').forEach((button) =>
      button.setAttribute('aria-pressed', String(Number(button.dataset.transformFactor) === factor)));
    controls.querySelector<HTMLElement>('[data-length-ratio]')!.textContent = `${factorText(factor)}倍`;
    controls.querySelector<HTMLElement>('[data-area-ratio]')!.textContent = `${factor === 0.5 ? '1/4' : factor * factor}倍`;
  }

  function renderArea(): void {
    const input = controls.querySelector<HTMLInputElement>('[data-area-answer]')!;
    if (input.value !== answer) input.value = answer;
    const kind = AREA_CHALLENGES[challengeIndex].kind;
    canvas.querySelector<SVGGElement>('[data-area-helper]')!.setAttribute('visibility', kind === 'count' || helperOpen ? 'visible' : 'hidden');
    canvas.querySelector<SVGGElement>('[data-area-grid]')!.setAttribute('visibility', kind === 'count' || (kind === 'rectangle' && helperOpen) ? 'visible' : 'hidden');
    controls.querySelector<HTMLButtonElement>('[data-transform-action="helper"]')?.setAttribute('aria-pressed', String(helperOpen));
  }

  function loadChallenge(): void {
    selectedCells = new Set();
    factor = 1;
    answer = '';
    helperOpen = false;
    hintOpen = false;
    const challenge = currentChallenge();
    taskTitle.textContent = challenge.label;
    taskDescription.textContent = challenge.description;
    container.querySelector<HTMLElement>('[data-task-count]')!.textContent = `${MODE_LABELS[mode]} ／ 課題 ${challengeIndex + 1} / 3`;
    container.querySelectorAll<HTMLButtonElement>('[data-transform-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.transformMode === mode)));
    previousButton.disabled = challengeIndex === 0;
    hint.hidden = true;
    hint.textContent = challenge.hint;
    hintButton.setAttribute('aria-expanded', 'false');
    discovery.hidden = true;
    if (mode === 'symmetry') {
      controlTitle.textContent = '右のマス';
      controls.innerHTML = '<p class="small-text transform-control-note">マスをタップ</p><button class="button button-soft transform-wide" data-transform-action="clear">色を消す</button>';
      canvas.innerHTML = symmetryScene();
      container.querySelector<HTMLElement>('[data-caption]')!.textContent = '鏡はまんなかの線。右のマスを押して、色をつけたり消したりできるよ。矢印キーで移動、スペースで色を変えよう。';
    } else if (mode === 'scale') {
      controlTitle.textContent = '何倍かな？';
      controls.innerHTML = `<div class="transform-factor-buttons" aria-label="倍率を選ぶ">${SCALING_CHALLENGES[challengeIndex].options.map((option) =>
        `<button class="button button-soft" data-transform-factor="${option}" aria-pressed="${option === 1}">${factorText(option)}倍</button>`).join('')}</div>
        <div class="transform-ratio-report"><p>長さ <strong data-length-ratio></strong></p><p>面積 <strong data-area-ratio></strong></p></div>`;
      canvas.innerHTML = scalingScene();
      renderScaling();
      container.querySelector<HTMLElement>('[data-caption]')!.textContent = '１マスの辺は1 cm。上と下は同じ目もりだよ。緑の形を点線に合わせよう。左右の矢印キーでも倍率を選べるよ。';
    } else {
      controlTitle.textContent = '面積は？';
      controls.innerHTML = `<label class="field-label" for="transform-area-answer">答え（cm²）</label>
        <input id="transform-area-answer" class="number-input transform-answer" data-area-answer type="number" min="0" max="999" step="1" inputmode="numeric" aria-label="面積の答え。単位は平方センチメートル。" placeholder="？"/>
        <div class="transform-number-buttons"><button class="button button-icon" data-transform-action="minus" aria-label="答えを１減らす">−</button><button class="button button-icon" data-transform-action="plus" aria-label="答えを１増やす">＋</button></div>
        ${AREA_CHALLENGES[challengeIndex].kind === 'count' ? '' : `<button class="button button-soft transform-wide transform-helper-button" data-transform-action="helper" aria-pressed="false">${AREA_CHALLENGES[challengeIndex].kind === 'rectangle' ? 'マスを見る' : '四角と比べる'}</button>`}`;
      canvas.innerHTML = areaScene();
      container.querySelector<HTMLElement>('[data-caption]')!.textContent = '面積は、1 cm²の正方形がいくつ入るかを表すよ。数字を入力して、たしかめよう。Enterキーでも答えを確認できるよ。';
    }
    say('どんな形になるかな？ 予想してから、ためしてみよう。');
  }

  function selectedCellList(): GridCell[] {
    return [...selectedCells].map((key) => {
      const [column, row] = key.split(',').map(Number);
      return { column, row };
    });
  }

  function check(): void {
    let success = false;
    let explanation = '';
    if (mode === 'symmetry') {
      const expected = REFLECTION_CHALLENGES[challengeIndex].source.map((cell) => reflectGridCell(cell, 2));
      success = sameCells(expected, selectedCellList());
      explanation = '線から同じだけ離れたマスが向かい合っているね。左右が入れかわっても、上と下の場所は同じだよ。';
    } else if (mode === 'scale') {
      const challenge = SCALING_CHALLENGES[challengeIndex];
      success = samePolygon(scalePolygon(challenge.source, factor), scalePolygon(challenge.source, challenge.targetFactor));
      const baseArea = polygonArea(challenge.source);
      const area = polygonArea(scalePolygon(challenge.source, factor));
      explanation = `長さが${factorText(factor)}倍になると、面積は${factor === 0.5 ? '1/4' : factor * factor}倍。もとの面積${baseArea} cm²が、${area} cm²になったね。縦と横の両方が変わるからだよ。`;
    } else {
      const numericAnswer = Number(answer);
      if (answer.trim() === '' || !Number.isFinite(numericAnswer) || !Number.isInteger(numericAnswer) || numericAnswer < 0) {
        say('答えを、０以上の整数で入れてみよう。単位は cm² だよ。');
        controls.querySelector<HTMLInputElement>('[data-area-answer]')!.focus({ preventScroll: true });
        return;
      }
      const challenge = AREA_CHALLENGES[challengeIndex];
      const area = polygonArea(challenge.polygon);
      success = numericAnswer === area;
      explanation = challenge.kind === 'triangle'
        ? `同じ三角形を２つ合わせると、4 × 3 = 12 cm²の長方形。三角形１つはその半分で、${area} cm²だね。`
        : `１行に${Math.max(...challenge.polygon.map((point) => point.x))}マス、その行が${Math.max(...challenge.polygon.map((point) => point.y))}行。合わせて${area}マスだから、${area} cm²だね。`;
    }
    if (success) {
      say(mode === 'symmetry' ? 'ぴったり！ 鏡の形ができたね。' : mode === 'scale' ? 'ぴったり！ 点線の見本に合ったね。' : 'できた！ 面積を見つけたね。', true);
      discovery.textContent = explanation;
      discovery.hidden = false;
      const id = `transform-${mode}-${currentChallenge().id}`;
      if (!earned.has(id)) {
        earned.add(id);
        context.onComplete(id, currentChallenge().label);
      }
    } else {
      say(mode === 'symmetry' ? 'もう少し！ 線からの距離と、マスの高さを見くらべよう。色のない場所も見てね。'
        : mode === 'scale' ? 'もう少し！ 緑の辺と、点線の辺が合う倍率を探してみよう。'
          : 'もう少し！ マスを数えたり、四角と比べたりして考え直してみよう。');
    }
  }

  function toggleCell(key: string): void {
    if (selectedCells.has(key)) selectedCells.delete(key); else selectedCells.add(key);
    renderSymmetry();
    if (lastSuccess) say('置き方を変えたね。もう一度たしかめてみよう。');
  }

  function onClick(event: MouseEvent): void {
    const target = event.target as Element;
    const cell = target.closest<SVGRectElement>('[data-transform-cell]');
    if (cell && mode === 'symmetry') { toggleCell(cell.dataset.transformCell!); return; }
    const button = target.closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.transformMode) {
      mode = button.dataset.transformMode as TransformMode;
      challengeIndex = 0;
      loadChallenge();
      return;
    }
    if (button.dataset.transformFactor !== undefined && mode === 'scale') {
      factor = Number(button.dataset.transformFactor);
      renderScaling();
      say('大きさを変えたよ。点線と見くらべて、たしかめよう。');
      return;
    }
    const action = button.dataset.transformAction;
    if (action === 'check') check();
    if (action === 'reset') loadChallenge();
    if (action === 'previous' && challengeIndex > 0) { challengeIndex -= 1; loadChallenge(); }
    if (action === 'next') {
      if (challengeIndex < 2) challengeIndex += 1;
      else { mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length]; challengeIndex = 0; }
      loadChallenge();
    }
    if (action === 'hint') {
      hintOpen = !hintOpen;
      hint.hidden = !hintOpen;
      hintButton.setAttribute('aria-expanded', String(hintOpen));
    }
    if (action === 'clear' && mode === 'symmetry') {
      selectedCells.clear();
      renderSymmetry();
      say('右の色を消したよ。もう一度ためしてみよう。');
    }
    if (action === 'helper' && mode === 'area') {
      helperOpen = !helperOpen;
      renderArea();
    }
    if ((action === 'plus' || action === 'minus') && mode === 'area') {
      const current = answer.trim() === '' || !Number.isFinite(Number(answer)) ? 0 : Math.round(Number(answer));
      answer = String(Math.min(999, Math.max(0, current + (action === 'plus' ? 1 : -1))));
      renderArea();
      if (lastSuccess) say('答えを変えたね。もう一度たしかめてみよう。');
    }
    if (action === 'narrate') {
      const challenge = currentChallenge();
      context.onNarrate?.(`${challenge.label}。${challenge.description} ${hintOpen ? challenge.hint : ''} ${lastFeedback}`);
    }
  }

  function onInput(event: Event): void {
    if ((event.target as Element).matches('[data-area-answer]')) {
      answer = (event.target as HTMLInputElement).value;
      if (lastSuccess) say('答えを変えたね。もう一度たしかめてみよう。');
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    const target = event.target as Element;
    if (target.matches('[data-area-answer]') && event.key === 'Enter') { event.preventDefault(); check(); return; }
    const cell = target.closest<SVGRectElement>('[data-transform-cell]');
    if (mode === 'symmetry' && cell) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleCell(cell.dataset.transformCell!); return; }
      let [column, row] = cell.dataset.transformCell!.split(',').map(Number);
      if (event.key === 'ArrowLeft') column = Math.max(2, column - 1);
      else if (event.key === 'ArrowRight') column = Math.min(3, column + 1);
      else if (event.key === 'ArrowUp') row = Math.max(0, row - 1);
      else if (event.key === 'ArrowDown') row = Math.min(3, row + 1);
      else if (event.key === 'Home') { column = 2; row = 0; }
      else if (event.key === 'End') { column = 3; row = 3; }
      else return;
      event.preventDefault();
      canvas.querySelector<SVGRectElement>(`[data-transform-cell="${column},${row}"]`)!.focus({ preventScroll: true });
    }
    if (mode === 'scale' && target.closest('[data-transform-board]') && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const options = SCALING_CHALLENGES[challengeIndex].options;
      const index = options.indexOf(factor);
      factor = options[Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))];
      renderScaling();
      say('大きさを変えたよ。点線と見くらべて、たしかめよう。');
    }
  }

  container.addEventListener('click', onClick, { signal: events.signal });
  container.addEventListener('input', onInput, { signal: events.signal });
  container.addEventListener('keydown', onKeyDown, { signal: events.signal });
  loadChallenge();
  return () => events.abort();
}
