import { transformPolygon, type PiecePose } from '../geometry/puzzle';
import { columnHeight } from '../geometry/construction';
import type { Block } from '../geometry/blocks';
import type { Answer, LearningTask, ShapeToken } from './types';

export interface PlayState {
  choice: number | null;
  cell: number | null;
  poses: PiecePose[];
  blocks: Block[];
  piece: number;
  hint: 0 | 1 | 2;
  support: boolean;
  aligned: boolean;
  units: boolean;
  normalized: boolean;
  view: 'diagonal' | 'front' | 'side' | 'top';
  action: 'add' | 'remove';
}
export type BlockPreview = (blocks: readonly Block[], view?: PlayState['view'], options?: { showOrigin?: boolean }) => string;
export const escapeText = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const btn = (action: string, text: string, extra = '', active = false) =>
  `<button type="button" class="button ${active ? 'selected' : 'button-soft'}" data-play="${action}" ${extra}>${text}</button>`;

export function initialState(task: LearningTask): PlayState {
  return { choice: null, cell: null, poses: task.kind === 'compose' ? task.pieces.map(p => ({...p.initial})) : [],
    blocks: task.kind === 'build' ? task.initial.map(b => ({...b})) : [], piece: 0, hint: 0, support: false,
    aligned: false, units: false, normalized: false, view: task.kind === 'build' ? task.view : 'diagonal', action: 'add' };
}
export function answerFromState(task: LearningTask, state: PlayState): Answer | undefined {
  if (task.kind === 'compose') return { kind: 'compose', poses: state.poses.map(p => ({...p})) };
  if (task.kind === 'build') return { kind: 'build', blocks: state.blocks.map(b => ({...b})) };
  if (task.kind === 'position') return state.cell === null ? undefined : { kind: 'position', cell: state.cell };
  return state.choice === null ? undefined : { kind: 'choice', index: state.choice };
}

export function tokenSvg(token: ShapeToken, normalized = false): string {
  const shape = token.shape === 'circle' ? '<circle r=".95"/>' : token.shape === 'square' ? '<rect x="-.9" y="-.9" width="1.8" height="1.8"/>'
    : token.shape === 'rectangle' ? '<rect x="-1.25" y="-.6" width="2.5" height="1.2"/>'
    : token.shape === 'triangle' ? '<polygon points="0,-1 .866025403784,.5 -.866025403784,.5"/>'
    : token.shape === 'right-triangle' ? '<polygon points="-.95,-.95 .95,.95 -.95,.95"/>'
    : token.shape === 'hexagon' ? '<polygon points="1,0 .5,.866 -.5,.866 -1,0 -.5,-.866 .5,-.866"/>'
    : '<polygon points="-.9,-.9 -.3,-.9 -.3,.3 .9,.3 .9,.9 -.9,.9"/>';
  return `<svg viewBox="-2 -2 4 4" aria-hidden="true"><g transform="rotate(${normalized ? 0 : token.rotation}) scale(${token.scale})" fill="${token.color}" stroke="#294f49" stroke-width=".045" stroke-linejoin="round">${shape}</g></svg>`;
}

function composeBoard(task: Extract<LearningTask,{kind:'compose'}>, state: PlayState) {
  const points = (p: readonly {x:number;y:number}[]) => p.map(v => `${v.x},${v.y}`).join(' ');
  const grid = Array.from({length:13},(_,i) => i / 2).map(n => `<path d="M${n} 0V6 M0 ${n}H6"/>`).join('');
  const ghost = state.hint === 2 ? task.pieces.map((piece,i) => `<polygon points="${points(transformPolygon(piece.points,task.solution[i]))}" fill="none" stroke="#b37d2c" stroke-width=".055" stroke-dasharray=".12 .08"/>`).join('') : '';
  const pieces = task.pieces.map((piece,i) => `<g data-board-piece="${i}"><polygon points="${points(transformPolygon(piece.points,state.poses[i]))}" fill="${piece.color}" fill-opacity=".84" stroke="${i===state.piece?'#a4572c':'#294f49'}" stroke-width="${i===state.piece?'.08':'.035'}" stroke-linejoin="round"/><circle cx="${state.poses[i].x}" cy="${state.poses[i].y}" r=".09" fill="#294f49"/><text x="${state.poses[i].x+.14}" y="${state.poses[i].y-.14}" font-size=".35" fill="#294f49">${i+1}</text></g>`).join('');
  return `<p class="pre-figure-label">てんせんを うめよう</p><svg class="pre-compose-board" viewBox="-2 -2 10 10" role="img" aria-label="てんせんのかたちと、うごかせるピース"><g stroke="#d7dfd0" stroke-width=".018">${grid}</g><polygon points="${points(task.target)}" fill="#e7eddd" stroke="#587c68" stroke-width=".045" stroke-dasharray=".13 .08"/>${ghost}${pieces}</svg><p class="small-text">●が ピースの めじるし。おく ばしょを タップでも えらべるよ。</p>`;
}
function positionBoard(task: Extract<LearningTask,{kind:'position'}>, state: PlayState) {
  const icons = { box:'📦', tree:'🌳', house:'🏠' };
  return `<p class="pre-observer ${task.observer==='top'?'':'pre-observer-spacer'}">${task.observer==='top'?'🧒 ↓ ここから みるひと':'ちずの うえ'}</p><div class="pre-map">${Array.from({length:9},(_,cell)=>{
    const anchor=task.anchors.find(a=>a.cell===cell);
    return `<div class="pre-map-cell ${state.cell===cell?'selected':''}"><small>${cell+1}</small><span>${anchor?icons[anchor.icon]:state.cell===cell?'🐻':''}</span>${anchor?`<p>${escapeText(anchor.label)}</p>`:''}</div>`;
  }).join('')}</div><p class="pre-observer">${task.observer==='bottom'?'🧒 ↑ ここから みるひと':'ちずの した'}</p><p class="small-text">くまの おうちを きめよう。</p>`;
}
function patternBoard(task: Extract<LearningTask,{kind:'pattern'}>) {
  return `<p class="pre-figure-label">この まとまりを くりかえすよ</p><div class="pre-pattern-unit">${task.unitPattern.map(t=>`<span>${tokenSvg(t)}</span>`).join('')}</div><p class="pre-figure-label">？に はいるのは？</p><div class="pre-pattern-sequence">${task.sequence.map((t,i)=>`<span class="pre-pattern-item"><small>${i+1}</small>${t?tokenSvg(t):'<strong>？</strong>'}</span>`).join('')}</div>`;
}
function lengthBoard(task: Extract<LearningTask,{kind:'length'}>, state: PlayState) {
  const n=task.rods.length+(task.referenceLength===undefined?0:1);
  const rods=task.rods.map((rod,i)=>{
    const x=state.aligned?1:1+rod.offset, y=1+i*1.5;
    const ticks=state.units?Array.from({length:rod.length+1},(_,u)=>`<path d="M${x+u} ${y-.35}v.7" stroke="#294f49" stroke-width=".025"/>`).join(''):'';
    return `<text x=".15" y="${y+.08}" fill="#294f49" font-size=".4">${i+1}</text><rect x="${x}" y="${y-.25}" width="${rod.length}" height=".5" rx=".06" fill="${rod.color}" stroke="${state.choice===i?'#9c542e':'#294f49'}" stroke-width="${state.choice===i?'.085':'.025'}"/>${ticks}`;
  }).join('');
  const reference=task.referenceLength===undefined?'':`<rect x="1" y="${1+task.rods.length*1.5-.25}" width="${task.referenceLength}" height=".5" fill="none" stroke="#294f49" stroke-width=".035" stroke-dasharray=".1 .06"/>`;
  return `<p class="pre-figure-label">${task.rule==='equal'?'てんせんと おなじ ながさは？':'ながさを くらべよう'}</p><svg viewBox="0 0 12 ${n*1.5+1}" role="img" aria-label="おなじものさしでかいた、ながさのちがうぼう">${rods}${reference}</svg><p class="small-text">${state.units?'ひとマスは、どのぼうも おなじ ながさ。':'いろや おくばしょで、ながさは かわらないよ。'}</p>`;
}
function projectionSvg(cells: readonly {u:number;v:number}[], view: string) {
  return `<svg viewBox="-.2 -.2 3.4 3.4" role="img" aria-label="３かける３のマスの図"><path d="M0 0H3V3H0Z M1 0V3 M2 0V3 M0 1H3 M0 2H3" fill="#f9f6ed" stroke="#b7cbbd" stroke-width=".025"/>${cells.map(c=>`<rect x="${view==='side'?c.u+2:c.u}" y="${view==='top'?-c.v:2-c.v}" width="1" height="1" fill="#81b8a2" stroke="#294f49" stroke-width=".035"/>`).join('')}<circle cx="${view==='side'?2.85:.15}" cy="${view==='top'?.15:2.85}" r=".09" fill="#c17c35"/></svg>`;
}
function buildBoard(task: Extract<LearningTask,{kind:'build'}>, state: PlayState, preview?: BlockPreview) {
  if (!preview) return '<p class="small-text">つみきを ひらいているよ…</p>';
  const names={front:'まえ',side:'みぎよこ',top:'うえ',diagonal:'ななめ'};
  const target=task.mode==='projections' && !state.support ? `<div class="pre-projections">${Object.entries(task.projections??{}).map(([view,cells])=>`<section><p>${names[view as keyof typeof names]}</p>${projectionSvg(cells,view)}</section>`).join('')}</div>`
    : preview(task.target,state.view,{showOrigin:true});
  return `<section class="pre-build-world"><p class="pre-figure-label">${task.mode==='projections'?'この ずに あうように':'みほん'}</p>${target}</section><section class="pre-build-world"><p class="pre-figure-label">あなたの つみき：${state.blocks.length}こ</p>${preview(state.blocks,state.view,{showOrigin:true})}</section><p class="small-text">★と てまえの せんが めじるし。</p>`;
}
export function boardMarkup(task: LearningTask, state: PlayState, preview?: BlockPreview) {
  if(task.kind==='shape') return `<p class="pre-figure-label">おなじ かたちを さがそう</p><div class="pre-shape-reference">${tokenSvg(task.reference,state.normalized)}</div><p class="small-text">みぎの かたちから えらぼう。</p>`;
  if(task.kind==='compose')return composeBoard(task,state);
  if(task.kind==='position')return positionBoard(task,state);
  if(task.kind==='pattern')return patternBoard(task);
  if(task.kind==='length')return lengthBoard(task,state);
  return buildBoard(task,state,preview);
}

export function controlsMarkup(task: LearningTask, state: PlayState) {
  if(task.kind==='shape'||task.kind==='pattern')return `<p class="small-text">どれかな？</p><div class="pre-options">${task.options.map((t,i)=>btn('choice',`${tokenSvg(t,task.kind==='shape'&&state.normalized)}<span>${i+1}</span>`,`data-value="${i}" aria-label="${i+1}ばんのかたち" aria-pressed="${state.choice===i}"`,state.choice===i)).join('')}</div>${task.kind==='shape'?btn('normalize','むきを<br>そろえる'):''}`;
  if(task.kind==='compose')return `<p class="small-text">ピースを えらぶ</p><div class="pre-piece-options">${task.pieces.map((p,i)=>btn('piece',`<span class="pre-piece-dot" style="background:${p.color}"></span>${i+1}`,`data-value="${i}" aria-pressed="${state.piece===i}"`,state.piece===i)).join('')}</div><p class="small-text">うごかす</p><div class="pre-arrow-controls">${btn('move','↑','data-value="up" aria-label="うえへ"')}${btn('move','↓','data-value="down" aria-label="したへ"')}${btn('move','←','data-value="left" aria-label="ひだりへ"')}${btn('move','→','data-value="right" aria-label="みぎへ"')}</div>${btn('rotate','↻ まわす')}`;
  if(task.kind==='position')return `<p class="small-text">ばしょを えらぶ</p><div class="pre-cell-controls">${Array.from({length:9},(_,cell)=>btn('cell',`${cell+1}`,`data-value="${cell}" aria-label="${cell+1}ばんのばしょ" aria-pressed="${state.cell===cell}" ${task.anchors.some(a=>a.cell===cell)?'disabled':''}`,state.cell===cell)).join('')}</div><p class="small-text">ばんごうは ちずと おなじ。</p>`;
  if(task.kind==='length')return `<p class="small-text">どの ぼうかな？</p><div class="pre-options">${task.rods.map((_,i)=>btn('choice',`${i+1}`,`data-value="${i}" aria-label="${i+1}ばんのぼう" aria-pressed="${state.choice===i}"`,state.choice===i)).join('')}</div>${btn('align','はしを<br>そろえる')}${btn('units','ますで<br>くらべる')}`;
  const names={diagonal:'ななめ',front:'まえ',side:'みぎよこ',top:'うえ'};
  return `<p class="small-text">${task.mode==='projections'?'あなたの むき':'みる むき'}</p><div class="pre-view-controls">${Object.entries(names).map(([v,n])=>btn('view',n,`data-value="${v}" aria-pressed="${state.view===v}"`,state.view===v)).join('')}</div><div class="pre-view-controls">${btn('action','＋つむ','data-value="add" aria-pressed="'+(state.action==='add')+'"',state.action==='add')}${btn('action','−とる','data-value="remove" aria-pressed="'+(state.action==='remove')+'"',state.action==='remove')}</div><p class="small-text">うえからの ばしょ</p><div class="pre-cell-controls">${Array.from({length:9},(_,cell)=>btn('column',`<small>${cell===0?'★':cell+1}</small><strong>${columnHeight(state.blocks,cell%3,Math.floor(cell/3))}</strong>`,`data-value="${cell}" aria-label="${cell+1}ばん、高さ${columnHeight(state.blocks,cell%3,Math.floor(cell/3))}、${state.action==='add'?'つむ':'とる'}"`)).join('')}</div><p class="small-text">↓ てまえ</p>${task.mode==='projections'?btn('reveal','みほんを<br>みる'):''}`;
}
