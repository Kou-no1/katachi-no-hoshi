import { MEASURE_TASKS, cuboidBlocks, exposedFaces } from '../geometry/measure';
import { blocksInLayer } from '../geometry/blocks';
import { createBlockScene, type ConstructionView } from '../shared/block-scene';
import type { GameContext } from '../types';
import './measure.css';
export function mountMeasure(container:HTMLElement,context:GameContext):()=>void {
  let index=0,mode:'volume'|'surface'='volume',answer:number|null=null,layer:number|null=null;
  const abort=new AbortController();
  const task=()=>MEASURE_TASKS[index];
  const blocks=()=>cuboidBlocks(task().width,task().height,task().depth);
  container.innerHTML=`<nav class="measure-modes"><button type="button" class="button button-soft" data-measure-mode="volume" aria-pressed="true">体積</button><button type="button" class="button button-soft" data-measure-mode="surface" aria-pressed="false">表面積</button></nav><section class="panel measure-intro"><p class="task-kicker" id="measure-step"></p><h2 class="task-title"></h2><p class="task-description"></p></section><section class="lab-stage"><div class="stage-workspace measure-workspace"><div class="measure-world"><div id="measure-scene" class="canvas-host" role="img" aria-label="１cmの積み木でできた直方体"></div><p class="small-text" id="measure-dimensions"></p></div><aside class="stage-controller measure-controller"><h3>見る向き</h3><div class="measure-views">${[['diagonal','ななめ'],['front','前'],['side','右よこ'],['top','上']].map(([view,label])=>`<button type="button" class="button button-soft" data-measure-view="${view}">${label}</button>`).join('')}</div><label for="measure-answer" class="field-label" id="measure-unit"></label><input id="measure-answer" class="number-input" type="number" min="0" max="100" step="1" inputmode="numeric" aria-label="予想した数"><button type="button" class="button button-primary" id="measure-check">たしかめる</button><button type="button" class="button button-soft" id="measure-hint" aria-expanded="false">ヒント</button><div id="measure-hint-content" hidden><p class="small-text" id="measure-hint-copy"></p><div class="measure-layers"></div></div><button type="button" class="button button-soft" id="measure-next">つぎのはこ</button></aside></div><div class="measure-result"><p class="feedback" role="status" id="measure-feedback"></p></div></section>`;
  const get=<T extends HTMLElement=HTMLElement>(s:string)=>container.querySelector<T>(s)!;
  const scene=createBlockScene(get('#measure-scene'));
  function feedback(text:string,success=false){get('#measure-feedback').textContent=text;get('#measure-feedback').classList.toggle('success',success);}
  function render(){
    answer=null;layer=null;get<HTMLInputElement>('#measure-answer').value='';
    get('#measure-step').textContent=`${index+1} / 3 ・ １辺１cmの積み木`;
    get('.task-title').textContent=task().name;
    get('.task-description').textContent=mode==='volume'?'このはこの体積は、何cm³かな？ １cm³の積み木がいくつ入るか考えよう。':'このはこの表面積は、何cm²かな？ 外に出ている６つの面の広さを合わせよう。';
    get('#measure-dimensions').textContent=`よこ ${task().width}cm ・ 高さ ${task().height}cm ・ 奥ゆき ${task().depth}cm`;
    get('#measure-unit').textContent=mode==='volume'?'体積（cm³）':'表面積（cm²）';
    get('#measure-hint-content').hidden=true;get('#measure-hint').setAttribute('aria-expanded','false');
    get('#measure-hint-copy').textContent=mode==='volume'?`１だんに ${task().width*task().depth}こあるよ。同じだんが ${task().height}だんあるね。`:`前の面は ${task().width*task().height}cm²、よこの面は ${task().depth*task().height}cm²、上の面は ${task().width*task().depth}cm²。同じ広さの面が２つずつあるよ。`;
    get('.measure-layers').innerHTML=mode==='volume'?`<button type="button" class="button button-soft" data-measure-layer="all">ぜんぶ</button>${Array.from({length:task().height},(_,i)=>`<button type="button" class="button button-soft" data-measure-layer="${i}">${i+1}だんめ</button>`).join('')}`:'';
    scene.setBlocks(blocks());scene.setView('diagonal');feedback('先に数を予想してみよう。向きを変えてたしかめられるよ。');
    context.onNarrate?.(`${task().name}。${mode==='volume'?'体積':'表面積'}を予想しよう。`);
  }
  get<HTMLInputElement>('#measure-answer').addEventListener('input',()=>{const input=get<HTMLInputElement>('#measure-answer');answer=input.value.trim()===''?null:Number(input.value);},{signal:abort.signal});
  get<HTMLInputElement>('#measure-answer').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();get<HTMLButtonElement>('#measure-check').click();}},{signal:abort.signal});
  container.addEventListener('click',e=>{
    const b=(e.target as Element).closest<HTMLButtonElement>('button');if(!b)return;
    if(b.dataset.measureMode){mode=b.dataset.measureMode as typeof mode;index=0;container.querySelectorAll<HTMLElement>('[data-measure-mode]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();}
    else if(b.dataset.measureView)scene.setView(b.dataset.measureView as ConstructionView);
    else if(b.dataset.measureLayer){layer=b.dataset.measureLayer==='all'?null:Number(b.dataset.measureLayer);scene.setBlocks(layer===null?blocks():blocksInLayer(blocks(),layer));feedback(layer===null?'ぜんぶのだんを見ているよ。':`${layer+1}だんめだけを見ているよ。`);}
    else if(b.id==='measure-next'){index=(index+1)%3;render();}
    else if(b.id==='measure-hint'){get('#measure-hint-content').hidden=!get('#measure-hint-content').hidden;b.setAttribute('aria-expanded',String(!get('#measure-hint-content').hidden));if(get('#measure-hint-content').hidden){layer=null;scene.setBlocks(blocks());}}
    else if(b.id==='measure-check'){
      const expected=mode==='volume'?blocks().length:exposedFaces(blocks());
      if(answer===null||!Number.isInteger(answer)||answer<0){feedback('予想した整数を入れてね。');return;}
      if(answer!==expected){feedback(mode==='volume'?'もう一度考えよう。１だんの数と、だんの数をくらべてみよう。':'もう一度考えよう。見えていない面も数えてみよう。');return;}
      feedback(`正解！ ${expected}${mode==='volume'?'cm³の体積':'cm²の表面積'}だね。`,true);context.onComplete(`box-measure-${mode}-${index}`,`${task().name}の${mode==='volume'?'体積':'表面積'}`);
    }
  },{signal:abort.signal});
  render();return()=>{abort.abort();scene.dispose();container.replaceChildren();};
}
