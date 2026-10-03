import { BUILDINGS } from '../geometry/blocks';
import { mountBlocks } from './blocks';
import { mountConstruction } from './construction';
import { blockPreviewSvg } from '../shared/block-scene';
import { readWorkshop } from '../workshop-storage';
import type { GameContext } from '../types';

type Activity = 'explore' | 'copy' | 'free' | 'gallery';
const labels: Record<Activity, string> = { explore: 'たんけんする', copy: 'まねして作る', free: '自由に作る', gallery: 'わたしの基地' };
export function mountBlockHub(container: HTMLElement, context: GameContext): () => void {
  let activity: Activity | undefined;
  let cleanup: (() => void) | undefined;
  const abort = new AbortController();
  container.innerHTML = `<nav class="block-activities" aria-label="ブロックのあそび方">${(Object.keys(labels) as Activity[]).map(id => `<button type="button" class="button button-soft" data-block-activity="${id}" aria-pressed="${id === 'explore'}">${labels[id]}</button>`).join('')}</nav><div class="block-activity-content"></div>`;
  const content = container.querySelector<HTMLElement>('.block-activity-content')!;
  function open(id: Activity, creation?: string) {
    if (activity === id && !creation) return;
    cleanup?.(); activity = id;
    container.querySelectorAll<HTMLElement>('[data-block-activity]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.blockActivity === id)));
    if (id === 'explore') cleanup = mountBlocks(content, context);
    else if (id === 'copy' || id === 'free') {
      const saved = readWorkshop();
      cleanup = mountConstruction(content, context, { mode: id, task: creation && creation !== 'free' ? BUILDINGS.findIndex(b => b.id === creation) : 0, initial: creation ? saved.drafts[creation] ?? saved.creations[creation] : undefined, onGallery: () => open('gallery') });
    }
    else {
      cleanup = undefined;
      const creations = readWorkshop().creations;
      const cards = [...BUILDINGS.map(b => ({ id: b.id, name: b.name })), { id: 'free', name: 'わたしの建物' }];
      content.innerHTML = `<section class="panel base-gallery"><p class="task-kicker">つくった建物が、ほしにあつまる</p><h2 class="task-title">わたしの基地</h2><p class="task-description">見本をつくったら、ここに建物がふえるよ。自由に作った建物も飾ろう。</p><div class="base-cards">${cards.map(card => `<article class="base-card ${creations[card.id] ? 'base-card-earned' : ''}"><div class="base-preview" role="img" aria-label="${creations[card.id] ? card.name : 'まだ建物がありません'}">${creations[card.id] ? blockPreviewSvg(creations[card.id]) : '<span aria-hidden="true">✧</span>'}</div><h3>${card.name}</h3><p class="small-text">${creations[card.id] ? 'きちに飾ったよ！' : 'これからつくろう'}</p><button type="button" class="button button-soft" data-open-creation="${card.id}">${creations[card.id] ? 'つづきを作る' : 'つくりにいく'}</button></article>`).join('')}</div><p class="small-text">自由な建物は１つ飾れるよ。作り直して飾ると、新しい建物にかわるよ。</p></section>`;
      context.onNarrate?.('わたしの基地。つくった建物を、ここに飾ろう。');
    }
  }
  container.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || !container.contains(button)) return;
    if (button.dataset.blockActivity) open(button.dataset.blockActivity as Activity);
    if (button.dataset.openCreation) open(button.dataset.openCreation === 'free' ? 'free' : 'copy', button.dataset.openCreation);
  }, { signal: abort.signal });
  open('explore');
  return () => { abort.abort(); cleanup?.(); container.replaceChildren(); };
}
