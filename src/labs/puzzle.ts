import type { GameContext } from '../types';
import { evaluatePuzzle, PUZZLE_CHALLENGES, transformPolygon } from '../geometry/puzzle';
import type { PiecePose, Point } from '../geometry/puzzle';
import './puzzle.css';

const pointsAttribute = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ');
const snapped = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value / 20) * 20));

export function mountPuzzle(container: HTMLElement, context: GameContext): () => void {
  let challengeIndex = 0;
  let selectedIndex = 0;
  let poses: PiecePose[] = [];
  let showHint = false;
  let placementArmed = false;
  const awarded = new Set<string>();
  let pointer: { id: number; pieceIndex: number | null; start: Point; offset: Point; dragged: boolean; placeOnTap: boolean } | null = null;

  container.innerHTML = `
    <div class="lab-layout puzzle-lab">
      <div class="lab-stage">
        <div class="stage-toolbar puzzle-toolbar">
          <span class="badge">かたち工房</span>
          <span class="small-text">選ぶ → 動かす → たしかめる</span>
        </div>
        <div class="canvas-host puzzle-canvas">
          <svg class="puzzle-board" viewBox="0 0 640 420" role="group" aria-label="ピースを動かす場所。矢印キーで移動、Rで回転、数字キーでピースを選べます。" tabindex="0"></svg>
        </div>
        <div class="puzzle-underboard">
          <div class="puzzle-piece-select" aria-label="動かすピースを選ぶ"></div>
          <p class="small-text">ピースを運ぼう。選んでから、置く場所をタップしてもいいよ。</p>
        </div>
      </div>
      <aside class="lab-sidebar">
        <div class="panel">
          <p class="task-kicker">MISSION <span data-mission-number></span></p>
          <h2 class="task-title" data-title></h2>
          <p class="task-description" data-description></p>
          <div class="puzzle-challenges" aria-label="あそびを選ぶ">
            <button class="button button-soft" data-challenge="0">さんかくで しかく</button>
            <button class="button button-soft" data-challenge="1">くるっと あわせよう</button>
          </div>
        </div>
        <div class="panel puzzle-controls">
          <h3 class="panel-title">ピースを動かそう</h3>
          <p class="small-text" data-selected></p>
          <div class="puzzle-dpad" aria-label="選んだピースを動かす">
            <button class="button button-icon puzzle-up" data-action="up" aria-label="上へ動かす">↑</button>
            <button class="button button-icon puzzle-left" data-action="left" aria-label="左へ動かす">←</button>
            <button class="button button-soft puzzle-rotate" data-action="rotate" aria-label="右に90度回す">↻<span>くるっと</span></button>
            <button class="button button-icon puzzle-right" data-action="right" aria-label="右へ動かす">→</button>
            <button class="button button-icon puzzle-down" data-action="down" aria-label="下へ動かす">↓</button>
          </div>
          <button class="button button-primary puzzle-check" data-action="check">これで どうかな？</button>
          <p class="feedback puzzle-feedback" aria-live="polite" aria-atomic="true" data-feedback></p>
          <div class="button-row">
            <button class="button button-soft" data-action="hint" aria-expanded="false">ヒント</button>
            <button class="button button-soft" data-action="reset">はじめから</button>
          </div>
          <p class="hint puzzle-hint" data-hint hidden></p>
          <p class="small-text puzzle-keyboard">キーボード：矢印で移動 ／ Rで回す ／ １・２で選ぶ</p>
        </div>
      </aside>
    </div>`;

  const svg = container.querySelector<SVGSVGElement>('.puzzle-board')!;
  const feedback = container.querySelector<HTMLElement>('[data-feedback]')!;
  const pieceSelect = container.querySelector<HTMLElement>('.puzzle-piece-select')!;
  const selectedText = container.querySelector<HTMLElement>('[data-selected]')!;
  const hint = container.querySelector<HTMLElement>('[data-hint]')!;
  const hintButton = container.querySelector<HTMLButtonElement>('[data-action="hint"]')!;
  const challenge = () => PUZZLE_CHALLENGES[challengeIndex];

  function say(message: string, success = false): void {
    feedback.textContent = message;
    feedback.classList.toggle('is-success', success);
  }

  function renderBoard(): void {
    const current = challenge();
    const order = current.pieces.map((_, index) => index).filter((index) => index !== selectedIndex);
    order.push(selectedIndex);
    const pieces = order.map((index) => {
      const piece = current.pieces[index];
      const transformed = transformPolygon(piece.points, poses[index]);
      const center = transformed.reduce((sum, point) => ({ x: sum.x + point.x / transformed.length, y: sum.y + point.y / transformed.length }), { x: 0, y: 0 });
      return `<g data-piece="${index}" role="button" tabindex="0" aria-label="ピース${piece.label}を選ぶ" aria-pressed="${index === selectedIndex}" class="puzzle-piece ${index === selectedIndex ? 'is-selected' : ''}">
        <polygon points="${pointsAttribute(transformed)}" fill="${piece.color}" stroke="#294f49" stroke-width="${index === selectedIndex ? 4 : 2}" stroke-linejoin="round"/>
        <text x="${center.x}" y="${center.y + 7}" text-anchor="middle" class="puzzle-piece-number">${piece.label}</text>
      </g>`;
    }).join('');
    svg.innerHTML = `
      <defs>
        <pattern id="puzzle-dot-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="1.2" fill="#d7dfd3"/></pattern>
        <filter id="puzzle-piece-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#294f49" flood-opacity=".10"/></filter>
      </defs>
      <rect width="640" height="420" rx="20" fill="#fcf9ef"/>
      <rect x="20" y="100" width="600" height="280" fill="url(#puzzle-dot-grid)"/>
      <text x="155" y="62" text-anchor="middle" class="puzzle-board-label">ピースを はこぼう</text>
      <text x="460" y="62" text-anchor="middle" class="puzzle-board-label">ここに ぴったり！</text>
      <path d="M290 66 C320 46 345 46 366 62 M353 53 L366 62 L352 68" stroke="#aebdb0" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <polygon points="${pointsAttribute(current.target)}" fill="#efe9d6" stroke="#9b9479" stroke-width="3" stroke-dasharray="7 6" stroke-linejoin="round"/>
      ${pieces}`;
    selectedText.textContent = `いま選んでいるのは ピース${current.pieces[selectedIndex].label}`;
    // Keep these controls in place so pointer/keyboard selection retains focus.
    pieceSelect.querySelectorAll<HTMLButtonElement>('[data-select]').forEach((button) => {
      const selected = Number(button.dataset.select) === selectedIndex;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function loadChallenge(index: number): void {
    challengeIndex = index;
    selectedIndex = 0;
    poses = challenge().pieces.map((piece) => ({ ...piece.initialPose }));
    showHint = false;
    placementArmed = false;
    pointer = null;
    pieceSelect.innerHTML = challenge().pieces.map((piece, pieceIndex) =>
      `<button class="button button-soft puzzle-select-button" data-select="${pieceIndex}" aria-pressed="false"><span style="background:${piece.color}" aria-hidden="true"></span>ピース${piece.label}</button>`,
    ).join('');
    container.querySelector<HTMLElement>('[data-mission-number]')!.textContent = `${index + 1} / ${PUZZLE_CHALLENGES.length}`;
    container.querySelector<HTMLElement>('[data-title]')!.textContent = challenge().label;
    container.querySelector<HTMLElement>('[data-description]')!.textContent = challenge().description;
    container.querySelectorAll<HTMLButtonElement>('[data-challenge]').forEach((button) => {
      const active = Number(button.dataset.challenge) === index;
      button.classList.toggle('is-selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    hint.hidden = true;
    hint.textContent = challenge().hint;
    hintButton.setAttribute('aria-expanded', 'false');
    say('まずは動かして、ためしてみよう。');
    renderBoard();
  }

  function updatePose(x: number, y: number): void {
    const pose = poses[selectedIndex];
    pose.x = snapped(x, 80, 560);
    pose.y = snapped(y, 100, 340);
    renderBoard();
  }

  function act(action: string): void {
    const pose = poses[selectedIndex];
    if (action === 'reset') { loadChallenge(challengeIndex); return; }
    if (action === 'hint') {
      showHint = !showHint;
      hint.hidden = !showHint;
      hintButton.setAttribute('aria-expanded', String(showHint));
      return;
    }
    if (action === 'check') {
      const evaluation = evaluatePuzzle(challenge(), poses);
      if (evaluation.success) {
        say(challengeIndex === 0 ? 'ぴったり！ ２つの三角で四角ができたね。' : 'ぴったり！ 回しても、ピースの形は同じだね。', true);
        if (!awarded.has(challenge().id)) {
          awarded.add(challenge().id);
          context.onComplete(`puzzle-${challenge().id}`, challenge().label);
        }
      } else if (evaluation.overlapArea > 0.01) {
        say('ピースが重なっているよ。長い辺を合わせてみよう。');
      } else {
        say(challengeIndex === 0 ? 'もう少し！ 点線からはみ出さず、すきまなく合わせよう。' : 'もう少し！ 向きと場所を、点線と見くらべよう。');
      }
      return;
    }
    if (action === 'rotate') {
      pose.rotation = (pose.rotation + 90) % 360;
      renderBoard();
      say('くるっと回ったよ。どこが変わったかな？');
      return;
    }
    const moves: Record<string, Point> = { up: { x: 0, y: -20 }, down: { x: 0, y: 20 }, left: { x: -20, y: 0 }, right: { x: 20, y: 0 } };
    if (moves[action]) {
      updatePose(pose.x + moves[action].x, pose.y + moves[action].y);
      say('いい場所に置けたら、たしかめてみよう。');
    }
  }

  function boardPoint(event: PointerEvent): Point {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function onPointerDown(event: PointerEvent): void {
    if (pointer || event.button !== 0) return;
    event.preventDefault();
    const pieceElement = (event.target as Element).closest<SVGElement>('[data-piece]');
    const pieceIndex = pieceElement ? Number(pieceElement.dataset.piece) : null;
    const point = boardPoint(event);
    // A tap after a selector button places the chosen piece, even on another
    // piece. If this becomes a drag, the grabbed piece still follows naturally.
    const placeOnTap = placementArmed;
    placementArmed = false;
    if (pieceIndex !== null && !placeOnTap) selectedIndex = pieceIndex;
    pointer = { id: event.pointerId, pieceIndex, start: point,
      offset: pieceIndex === null ? { x: 0, y: 0 } : { x: point.x - poses[pieceIndex].x, y: point.y - poses[pieceIndex].y }, dragged: false, placeOnTap };
    svg.setPointerCapture(event.pointerId);
    svg.focus({ preventScroll: true });
    renderBoard();
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId || pointer.pieceIndex === null) return;
    const point = boardPoint(event);
    if (!pointer.dragged && Math.hypot(point.x - pointer.start.x, point.y - pointer.start.y) > 6) {
      pointer.dragged = true;
      selectedIndex = pointer.pieceIndex;
    }
    if (pointer.dragged) updatePose(point.x - pointer.offset.x, point.y - pointer.offset.y);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!pointer || pointer.id !== event.pointerId) return;
    if (!pointer.dragged && (pointer.placeOnTap || pointer.pieceIndex === null)) {
      const point = boardPoint(event);
      updatePose(point.x, point.y);
      say('ピースを置いたよ。矢印で少しずつ動かせるよ。');
    } else if (pointer.dragged) {
      say('いい場所に置けたら、たしかめてみよう。');
    } else {
      say(`ピース${challenge().pieces[selectedIndex].label}を選んだよ。置く場所をタップしてみよう。`);
    }
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    pointer = null;
  }

  function onPointerCancel(): void { pointer = null; }

  function onClick(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.challenge !== undefined) loadChallenge(Number(button.dataset.challenge));
    if (button.dataset.select !== undefined) {
      selectedIndex = Number(button.dataset.select);
      placementArmed = true;
      renderBoard();
      say(`ピース${challenge().pieces[selectedIndex].label}を選んだよ。次に、置く場所をタップしよう。`);
    }
    if (button.dataset.action) act(button.dataset.action);
  }

  function onKeyDown(event: KeyboardEvent): void {
    const pieceElement = (event.target as Element).closest<SVGElement>('[data-piece]');
    if (pieceElement && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectedIndex = Number(pieceElement.dataset.piece);
      renderBoard();
      svg.focus({ preventScroll: true });
      say(`ピース${challenge().pieces[selectedIndex].label}を選んだよ。`);
      return;
    }
    const keys: Record<string, string> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', r: 'rotate', R: 'rotate', Enter: 'check' };
    if (event.key === '1' || (event.key === '2' && challenge().pieces.length > 1)) {
      event.preventDefault();
      selectedIndex = Number(event.key) - 1;
      renderBoard();
      say(`ピース${challenge().pieces[selectedIndex].label}を選んだよ。`);
    } else if (keys[event.key]) {
      event.preventDefault();
      if (pieceElement) {
        selectedIndex = Number(pieceElement.dataset.piece);
        svg.focus({ preventScroll: true });
      }
      act(keys[event.key]);
    }
  }

  container.addEventListener('click', onClick);
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerCancel);
  svg.addEventListener('keydown', onKeyDown);
  loadChallenge(0);

  return () => {
    container.removeEventListener('click', onClick);
    svg.removeEventListener('pointerdown', onPointerDown);
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerup', onPointerUp);
    svg.removeEventListener('pointercancel', onPointerCancel);
    svg.removeEventListener('keydown', onKeyDown);
    pointer = null;
  };
}
