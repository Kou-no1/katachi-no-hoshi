import { Vector3 } from 'three';
import { BUILDINGS, type Block } from '../geometry/blocks';
import { BASE_CREATION_IDS, BASE_THEMES, isBaseCreationId, moveBaseCreation, rotateBaseModel, type BaseCreationId, type BaseRotation } from '../geometry/base';
import { readBase, saveBase } from '../base-storage';
import { readWorkshop } from '../workshop-storage';
import { blockPreviewSvg } from '../shared/block-scene';
import type { GameContext } from '../types';
import './base.css';

const names: Record<BaseCreationId, string> = {
  'little-house': BUILDINGS[0].name,
  lookout: BUILDINGS[1].name,
  'space-base': BUILDINGS[2].name,
  free: 'じゆうな建物',
};
// Same camera direction, right/up basis and target height as blockPreviewSvg.
// Translating a whole independent board then gives an exact orthographic scene.
const direction = new Vector3(7, 6, 8).normalize();
const right = new Vector3(0, 1, 0).cross(direction).normalize();
const up = direction.clone().cross(right).normalize();
const point = (x: number, y: number, z: number): [number, number] => {
  const relative = new Vector3(x, y - 1.45, z);
  return [relative.dot(right), -relative.dot(up)];
};
function boardContents(blocks: readonly Block[], rotation: BaseRotation, selected: boolean): string {
  const svg = blockPreviewSvg(rotateBaseModel(blocks, rotation), 'diagonal', { showOrigin: false, boardOutline: { color: selected ? '#b78335' : '#7d9a83', width: selected ? .09 : .035 } });
  // Use geometry inside the existing SVG, without its opaque full-frame backdrop.
  // Origin markers are omitted in favour of one origin for the whole base.
  return svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
}

export function mountBase(container: HTMLElement, context: GameContext): () => void {
  const creations = readWorkshop().creations;
  const available = BASE_CREATION_IDS.filter((id) => creations[id]?.length);
  const completedCount = () => Object.keys(context.getCompleted?.() ?? {}).length;
  const options = () => ({ availableIds: available, completedCount: completedCount() });
  let layout = readBase(options());
  let selected: BaseCreationId | null = available[0] ?? null;
  const abort = new AbortController();
  container.innerHTML = `<section class="panel base-intro"><p class="task-kicker">つくった作品で、わたしの基地</p><h2 class="task-title">作品を、星に置こう</h2><p class="task-description">作品をえらんで、置きたい場所を押そう。あいている場所へ動かしたり、向きを変えたりできるよ。</p><p class="small-text">９つの場所に、ひとつずつ作品を置けるよ。星は使わないので、数は同じだよ。</p></section>
    <section class="lab-stage base-stage"><div class="stage-workspace base-workspace">
      <div class="base-world"><h3>わたしの基地</h3><div class="base-map-host" id="base-map" role="img" aria-label="９つの場所がある基地"></div><p class="small-text base-map-key">★ 左奥<br><span>●</span> 赤い線は手前</p></div>
      <aside class="stage-controller base-controller" aria-label="基地の作品を置く操作">
        <h3>作品をえらぼう</h3><div class="base-building-picker"></div>
        <h3>どこに置く？</h3><div class="base-place-grid" aria-label="基地を上から見た９つの場所"></div><p class="small-text" style="text-align:center">↓ 手前</p>
        <h3>えらんだ作品</h3><div class="base-selected-preview" id="base-selected-preview" role="img" aria-label="えらんだ作品"></div><p class="small-text base-selected-name" id="base-selected-name"></p>
        <div class="base-rotation-actions"><button type="button" class="button button-soft" id="base-rotate">↻ くるっと90°</button><button type="button" class="button button-soft" id="base-remove">きちからしまう</button></div>
        <h3>どの星にする？</h3><p class="small-text" id="base-stars"></p><div class="base-themes"></div>
      </aside>
    </div><div class="base-result"><p class="feedback" id="base-feedback" role="status" aria-live="polite" aria-atomic="true"></p><p class="small-text" id="base-save-state"></p></div></section>`;
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const say = (message: string) => { get('#base-feedback').textContent = message; context.onNarrate?.(message); };

  function renderMap() {
    const theme = BASE_THEMES.find((candidate) => candidate.id === layout.theme)!;
    const ground = { grass: '#d2e1bc', blue: '#c5e0e8', sunset: '#edceb0' }[theme.id];
    const tiles = Array.from({ length: 9 }, (_, index) => {
      const x = index % 3, z = Math.floor(index / 3);
      const centerX = (x - 1) * 4, centerZ = (z - 1) * 4;
      return { x, z, index, centerX, centerZ, depth: centerX * direction.x + centerZ * direction.z };
    }).sort((a, b) => a.depth - b.depth);
    const contents = tiles.map(({ x, z, index, centerX, centerZ }) => {
      const id = BASE_CREATION_IDS.find((candidate) => layout.placements[candidate]?.x === x && layout.placements[candidate]?.z === z);
      const offset = new Vector3(centerX, 0, centerZ);
      const translate = `${offset.dot(right)},${-offset.dot(up)}`;
      const isSelected = id === selected;
      const board = boardContents(id ? creations[id] : [], id ? layout.placements[id]!.rotation : 0, isSelected);
      const [numberX, numberY] = point(0, -.005, 1.76);
      return `<g transform="translate(${translate})" data-base-tile="${index}">${board}<text x="${numberX}" y="${numberY + .16}" text-anchor="middle" font-size=".30" font-weight="700" fill="#486757">${index + 1}</text></g>`;
    }).join('');
    const origin = point(-5.7, .05, -5.7);
    const frontStart = point(-5.6, .01, 5.6), frontEnd = point(5.6, .01, 5.6);
    get('#base-map').innerHTML = `<svg viewBox="-8.6 -6.4 17.2 12.8" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><rect x="-8.6" y="-6.4" width="17.2" height="12.8" fill="${theme.color}"/><ellipse cx="0" cy="1.1" rx="8.05" ry="4.25" fill="${ground}"/>${contents}<path d="M${frontStart.join(',')} L${frontEnd.join(',')}" fill="none" stroke="#c68161" stroke-width=".065" stroke-linecap="round"/><text x="${origin[0]}" y="${origin[1]}" text-anchor="middle" font-size=".4" fill="#876120">★</text></svg>`;
    const placed = BASE_CREATION_IDS.filter((id) => layout.placements[id]);
    get('#base-map').setAttribute('aria-label', `${theme.name}の基地。${placed.length}この作品。${placed.map((id) => { const placement = layout.placements[id]!; return `${names[id]}は、${placement.z + 1}行目、${placement.x + 1}列目の場所。`; }).join('')}`);
  }
  function renderControls() {
    const picker = get('.base-building-picker');
    if (!picker.children.length) picker.innerHTML = BASE_CREATION_IDS.map((id) => `<button type="button" class="button button-soft" data-base-building="${id}" aria-pressed="false" ${available.includes(id) ? '' : 'disabled'}>${names[id]}${available.includes(id) ? '' : '<small>まだつくっていないよ</small>'}</button>`).join('');
    picker.querySelectorAll<HTMLElement>('[data-base-building]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.baseBuilding === selected)));
    const grid = get('.base-place-grid');
    if (!grid.children.length) grid.innerHTML = Array.from({ length: 9 }, (_, index) => `<button type="button" class="button button-soft" data-base-place="${index}"><strong>${index + 1}</strong><span></span></button>`).join('');
    grid.querySelectorAll<HTMLButtonElement>('[data-base-place]').forEach((button) => {
      const index = Number(button.dataset.basePlace), x = index % 3, z = Math.floor(index / 3);
      const id = BASE_CREATION_IDS.find((candidate) => layout.placements[candidate]?.x === x && layout.placements[candidate]?.z === z);
      button.querySelector('span')!.textContent = id ? '◆' : '·';
      button.classList.toggle('base-tile-occupied', !!id);
      button.classList.toggle('base-tile-selected', !!id && id === selected);
      button.setAttribute('aria-pressed', String(!!id && id === selected));
      button.setAttribute('aria-label', `${['奥', 'まんなか', '手前'][z]}の${['左', 'まんなか', '右'][x]}。${id ? names[id] + 'があるよ' : 'あいているよ'}`);
      button.disabled = !selected;
    });
    const placement = selected ? layout.placements[selected] : undefined;
    const preview = get('#base-selected-preview');
    preview.innerHTML = selected ? blockPreviewSvg(rotateBaseModel(creations[selected], placement?.rotation ?? 0), 'diagonal') : '<p class="small-text">作品をつくったら、ここで大きく見られるよ。</p>';
    preview.setAttribute('aria-label', selected ? `${names[selected]}。${creations[selected].length}このブロック。${placement ? placement.rotation * 90 : 0}度回した向き。` : '作品はまだありません');
    get('#base-selected-name').textContent = selected ? `${names[selected]} ／ ${placement ? `${placement.z * 3 + placement.x + 1}の場所` : 'まだ置いていないよ'}` : '作品を作ると、置けるようになるよ。';
    get<HTMLButtonElement>('#base-rotate').disabled = !placement;
    get<HTMLButtonElement>('#base-remove').disabled = !placement;
    get('#base-stars').textContent = `ひらめきの星は ${completedCount()}こ。数は同じだよ。`;
    const themes = get('.base-themes');
    if (!themes.children.length) themes.innerHTML = BASE_THEMES.map((theme) => `<button type="button" class="button button-soft" data-base-theme="${theme.id}"><span class="base-theme-swatch" style="background:${theme.color}" aria-hidden="true"></span>${theme.name}<small>星${theme.needed}こでひらく</small></button>`).join('');
    themes.querySelectorAll<HTMLButtonElement>('[data-base-theme]').forEach((button) => {
      const theme = BASE_THEMES.find((candidate) => candidate.id === button.dataset.baseTheme)!;
      const unlocked = completedCount() >= theme.needed;
      button.setAttribute('aria-pressed', String(layout.theme === theme.id));
      button.disabled = !unlocked;
      button.querySelector('small')!.hidden = unlocked;
    });
  }
  const render = () => { renderMap(); renderControls(); };
  const persist = (message: string) => {
    const saved = saveBase(layout, options());
    render(); say(message);
    get('#base-save-state').textContent = saved ? '場所と向きを、このブラウザに保存したよ。' : 'この画面を閉じるまでは、場所と向きを覚えているよ。';
  };
  function place(index: number) {
    if (!selected) { say('まだ作品がないよ。見本を作ったり、じゆうに作ったりしてから置こう。'); return; }
    const result = moveBaseCreation(layout.placements, selected, index % 3, Math.floor(index / 3));
    if (!result.moved) { say(result.reason === 'occupied' ? 'その場所には作品があるよ。あいている場所をえらぼう。' : 'この場所に置いてあるよ。別の場所へ動かしてもいいね。'); return; }
    layout.placements = result.placements;
    persist(`${names[selected]}を、${index + 1}の場所に置いたよ。`);
  }
  container.addEventListener('click', (event) => {
    const element = event.target as Element;
    const button = element.closest<HTMLButtonElement>('button');
    if (button && container.contains(button)) {
      if (button.dataset.baseBuilding && isBaseCreationId(button.dataset.baseBuilding) && available.includes(button.dataset.baseBuilding)) {
        selected = button.dataset.baseBuilding; render(); say(`${names[selected]}をえらんだよ。置きたい場所を押そう。`);
      } else if (button.dataset.basePlace !== undefined) place(Number(button.dataset.basePlace));
      else if (button.id === 'base-rotate' && selected && layout.placements[selected]) {
        const placement = layout.placements[selected]!;
        placement.rotation = ((placement.rotation + 1) % 4) as BaseRotation;
        persist('くるっと回したよ。作品の形と数は同じだよ。');
      } else if (button.id === 'base-remove' && selected) {
        delete layout.placements[selected]; persist('きちからしまったよ。作品はそのまま。好きな場所に、また置けるよ。');
      } else if (button.dataset.baseTheme) {
        const theme = BASE_THEMES.find((candidate) => candidate.id === button.dataset.baseTheme);
        if (theme && completedCount() >= theme.needed) { layout.theme = theme.id; persist(`${theme.name}になったよ。星の数は同じだよ。`); }
      }
      return;
    }
    const tile = element.closest<SVGGElement>('[data-base-tile]');
    if (tile && container.contains(tile)) place(Number(tile.dataset.baseTile));
  }, { signal: abort.signal });
  render();
  say(available.length ? '作品をえらんで、あいている場所に置こう。' : 'まだ作品がないよ。見本を作ったり、じゆうに作ったりすると、ここで置けるようになるよ。');
  return () => { abort.abort(); container.replaceChildren(); };
}
