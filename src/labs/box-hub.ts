import { mountBox } from './box';
import { mountMeasure } from './measure';
import type { GameContext } from '../types';
export function mountBoxHub(container:HTMLElement,context:GameContext):()=>void {
  const abort=new AbortController();let cleanup:(()=>void)|undefined;let mode='nets';
  container.innerHTML='<nav class="measure-modes"><button type="button" class="button button-soft" data-box-activity="nets" aria-pressed="true">展開図を折る</button><button type="button" class="button button-soft" data-box-activity="measure" aria-pressed="false">体積・表面積</button></nav><div class="box-activity-content"></div>';
  const host=container.querySelector<HTMLElement>('.box-activity-content')!;
  const open=()=>{cleanup?.();cleanup=mode==='nets'?mountBox(host,context):mountMeasure(host,context);};
  container.addEventListener('click',e=>{const b=(e.target as Element).closest<HTMLButtonElement>('[data-box-activity]');if(!b||b.dataset.boxActivity===mode)return;mode=b.dataset.boxActivity!;container.querySelectorAll<HTMLElement>('[data-box-activity]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));open();},{signal:abort.signal});
  open();return()=>{abort.abort();cleanup?.();container.replaceChildren();};
}
