import type { GameContext } from '../types';
import { editColumn } from '../geometry/construction';
import { transformPolygon } from '../geometry/puzzle';
import { LEARNING_UNITS, LEARNING_TASKS, LEVEL_NAMES, tasksForUnit, evaluateLearningTask, copyAnswer } from '../learning/catalog';
import { readLearningRecords, saveLearningRecords, addAttempt, deriveUnitSummary, recommendTask, type LearningAttempt } from '../learning/records';
import { initialState, answerFromState, boardMarkup, controlsMarkup, escapeText, type BlockPreview } from '../learning/render';
import type { UnitId, LearningTask } from '../learning/types';
import './preschool.css';

export function mountPreschool(container: HTMLElement, context: GameContext): () => void {
  const abort = new AbortController();
  let unit: UnitId = 'P01';
  let task: LearningTask = tasksForUnit(unit)[0];
  let state = initialState(task);
  let records = readLearningRecords();
  let checks = 0;
  let firstAnswer: LearningAttempt['firstAnswer'] | undefined;
  let attemptId = '';
  let completed = false;
  let attemptFinished = false;
  let saveAvailable = true;
  let sessionCompleted = new Set<string>();
  let preview: BlockPreview | undefined;
  let previewLoading = false;
  let message = '';
  let setRemaining: number | null = null;
  let edits: typeof state[] = [];

  container.innerHTML = `<section class="panel pre-welcome"><p class="task-kicker">ちいさな はっけんを あつめよう</p><h2 class="task-title">はじめの かたちあそび</h2><p class="small-text">６つのあそびに、12このもんだい。すきなところから、なんどでも。</p><div class="pre-unit-nav" aria-label="あそびをえらぶ"></div></section><div class="pre-task-area"></div>`;
  const get = <T extends HTMLElement=HTMLElement>(selector:string) => container.querySelector<T>(selector)!;
  const done = (id:string) => !!context.getCompleted?.()[id] || sessionCompleted.has(id);
  const snapshot = () => JSON.parse(JSON.stringify(state)) as typeof state;
  const rememberEdit = () => { edits.push(snapshot()); if(edits.length>60)edits.shift(); };

  function recordAttempt(correct: boolean) {
    if (!firstAnswer || attemptFinished) return;
    records = addAttempt(records, { attemptId, taskId: task.id, taskVersion: task.version, level: task.level,
      firstAnswer: copyAnswer(firstAnswer), checks, hintLevel: state.hint, supportUsed: state.support, correct, at: Date.now() });
    saveAvailable = saveLearningRecords(records);
    if(correct)attemptFinished=true;
  }
  function renderUnits() {
    get('.pre-unit-nav').innerHTML = LEARNING_UNITS.map(u=>`<button type="button" class="button pre-unit ${u.id===unit?'selected':''}" data-unit="${u.id}" aria-pressed="${u.id===unit}"><strong>${u.name}</strong><span>${u.caption}</span><small>${tasksForUnit(u.id).filter(t=>done(t.id)).length} / 12</small></button>`).join('');
  }
  function ensurePreview() {
    if(task.kind!=='build'||preview||previewLoading)return;
    previewLoading=true;
    void import('../shared/block-scene').then(module=>{
      preview=module.blockPreviewSvg; previewLoading=false;
      if(!abort.signal.aborted && task.kind==='build')renderPlay();
    }).catch(()=>{
      previewLoading=false;
      if(!abort.signal.aborted){message='つみきのずを ひらけなかったよ。もういちど えらんでみよう。';renderPlay();}
    });
  }
  function renderTask() {
    renderUnits();
    const summary=deriveUnitSummary(records,LEARNING_TASKS,unit);
    const tasks=tasksForUnit(unit);
    const currentUnit=LEARNING_UNITS.find(u=>u.id===unit)!;
    get('.pre-task-area').innerHTML = `<section class="panel pre-intro"><div class="pre-task-top"><span class="badge">${LEVEL_NAMES[task.level]} · ${tasks.indexOf(task)+1} / 12</span><button type="button" class="button button-soft" data-play="short-set">３もん あそぶ</button></div><h3 class="task-title">${escapeText(task.title)}</h3><p class="task-description">${escapeText(task.prompt)}</p><div class="pre-task-list" aria-label="もんだいをえらぶ">${tasks.map((t,i)=>`<button type="button" class="button ${t.id===task.id?'selected':'button-soft'}" data-task="${t.id}" aria-label="${i+1}ばん ${escapeText(t.title)} ${LEVEL_NAMES[t.level]}${done(t.id)?' たしかめた':''}" aria-pressed="${t.id===task.id}">${i+1}${done(t.id)?' ✓':''}</button>`).join('')}</div><p class="small-text">さわってみる２こ → ためしてみる４こ → 考えてみる４こ → はじめての図２こ。むずかしいときは、いつでも もどれるよ。</p>${task.kind==='build'&&task.mode==='projections'?'<p class="hint">もっとむずかしく、の あそび。２つのずにあえば、ちがうつくりかたも いいよ。</p>':''}</section>
      <section class="lab-stage pre-stage"><div class="stage-workspace pre-workspace ${(task.kind==='build'||task.kind==='position')?'pre-workspace-wide':''}"><div class="pre-figure"></div><aside class="stage-controller pre-controller" aria-label="あそびのそうさ"></aside></div><div class="pre-result"><p class="feedback" role="status" aria-live="polite" aria-atomic="true"></p><p class="pre-explanation small-text" hidden></p><div class="button-row"><button type="button" class="button button-primary" data-play="next">つぎへ</button><button type="button" class="button button-soft" data-play="easier">やさしいもんだい</button><button type="button" class="button button-soft" data-play="recommended">おすすめ</button></div><p class="pre-save-status small-text"></p></div></section>
      <details class="panel pre-adult"><summary>おうちの方・先生へ：実物でも遊ぼう</summary><div><h4>実物でためす</h4><p>${escapeText(task.realActivity)}</p><h4>声をかける・見るところ</h4><p>${escapeText(task.observe)}</p><h4>このあそびの記録</h4><p>${summary.completed}この課題を完成。お手伝いで完成：${summary.supported}こ。初見用の図を、初回の確認・ヒントなしで：${summary.independentTransfer}こ。</p><p>星はヒントを使っても同じです。完成の数だけで、理解したと決めません。初見用の課題で数回試した場合や、支援を使った場合も記録を分けます。課題の途中を離れた場合は、確認した答えまでを記録します。開いただけで答えていない課題は記録しません。ピースと積み木の制作途中は、このあそびでは保存しません。</p><a class="button" href="#${currentUnit.nextLab}">つながるラボへ</a></div></details>`;
    renderPlay();
    ensurePreview();
  }
  function renderPlay() {
    const active=document.activeElement as HTMLElement|null;
    const action=active?.dataset.play, value=active?.dataset.value;
    get('.pre-figure').innerHTML=boardMarkup(task,state,preview);
    get('.pre-controller').innerHTML=`${controlsMarkup(task,state)}<div class="pre-common-controls"><button type="button" class="button button-primary" data-play="check">たしかめる</button><button type="button" class="button button-soft" data-play="hint" aria-expanded="${state.hint>0}" ${state.hint===2?'disabled':''}>${state.hint===0?'ヒント':state.hint===1?'もうひとつ<br>ヒント':'ヒントをみた'}</button>${state.hint?`<p class="hint">${escapeText(task.hints[state.hint-1])}</p>`:''}<button type="button" class="button button-soft" data-play="undo" ${edits.length?'':'disabled'}>もどす</button><button type="button" class="button button-soft" data-play="restart">もういちど</button><button type="button" class="button button-soft" data-play="read">よんで</button></div>`;
    get('.feedback').textContent=message;
    get('.feedback').classList.toggle('success',completed);
    get('.pre-explanation').hidden=!completed;
    get('.pre-explanation').textContent=completed?task.explanation:'';
    get('.pre-save-status').textContent=saveAvailable?'記録は このブラウザに のこるよ。':'保存できないので、この画面を閉じるまで記録するよ。';
    if(action){const buttons=Array.from(container.querySelectorAll<HTMLElement>('[data-play]'));buttons.find(b=>b.dataset.play===action && b.dataset.value===value && !b.hasAttribute('disabled'))?.focus({preventScroll:true});}
  }
  function loadTask(next: LearningTask, keepSet=false) {
    recordAttempt(completed);
    unit=next.unit;task=next;state=initialState(task);checks=0;firstAnswer=undefined;completed=false;attemptFinished=false;edits=[];
    attemptId=typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
    if(!keepSet)setRemaining=null;
    message=task.level==='transfer'?'はじめてのず。まずは じぶんで。ヒントも いつでも つかえるよ。':'どうなるかな？ ためして たしかめよう。';
    renderTask();context.onNarrate?.(`${task.title}。${task.prompt}`);
  }
  function check() {
    const answer=answerFromState(task,state);
    if(!answer || (answer.kind==='build' && !answer.blocks.length)){message='まずは、えらぶか つくってみよう。';renderPlay();return;}
    if(completed){message='できたね！ つぎのもんだいや、もういちども えらべるよ。';renderPlay();return;}
    checks++;firstAnswer??=copyAnswer(answer);
    completed=evaluateLearningTask(task,answer);
    recordAttempt(completed);
    if(completed){
      sessionCompleted.add(task.id);context.onComplete(task.id,task.title);
      if(setRemaining!==null)setRemaining--;
      message=setRemaining===0?'３もん たしかめたね！ ここで おやすみしても、つづけても いいよ。':'できた！ どこをみて わかったかな？';
      renderTask();
      context.onNarrate?.(`${message} ${task.explanation}`);
    }else{
      message='もういちど くらべてみよう。ヒントも つかえるよ。';renderPlay();context.onNarrate?.(message);
    }
  }
  function beginAnswerEdit() {
    if(!completed)return;
    // Editing a finished answer starts another episode; its earned star and
    // first-check evidence remain intact while the new answer is graded again.
    completed=false;attemptFinished=false;checks=0;firstAnswer=undefined;setRemaining=null;
    attemptId=typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
    message='かたちを かえたね。もういちど たしかめてみよう。';
  }
  function move(dx:number,dy:number) {
    if(task.kind!=='compose')return;
    const pose=state.poses[state.piece];
    const next={...pose,x:pose.x+dx,y:pose.y+dy};
    const poly=transformPolygon(task.pieces[state.piece].points,next);
    if(poly.some(p=>p.x< -1.5 || p.x>7.5 || p.y< -1.5 || p.y>7.5))return;
    beginAnswerEdit();rememberEdit();state.poses[state.piece]=next;renderPlay();
  }
  container.addEventListener('click', event=>{
    const target=event.target as Element;
    const piece=target.closest<SVGElement>('[data-board-piece]');
    if(piece && task.kind==='compose'){state.piece=Number(piece.dataset.boardPiece);renderPlay();return;}
    const svg=target.closest<SVGSVGElement>('.pre-compose-board');
    if(svg && task.kind==='compose'){
      const point=svg.createSVGPoint();point.x=(event as MouseEvent).clientX;point.y=(event as MouseEvent).clientY;
      const matrix=svg.getScreenCTM();if(!matrix)return;
      const local=point.matrixTransform(matrix.inverse());const pose=state.poses[state.piece];
      move(Math.round(local.x*2)/2-pose.x,Math.round(local.y*2)/2-pose.y);return;
    }
    const button=target.closest<HTMLButtonElement>('button');if(!button || button.disabled || !container.contains(button))return;
    if(button.dataset.unit){const id=button.dataset.unit as UnitId;loadTask(recommendTask(LEARNING_TASKS,records,id)??tasksForUnit(id)[0]);return;}
    if(button.dataset.task){const next=LEARNING_TASKS.find(t=>t.id===button.dataset.task);if(next)loadTask(next);return;}
    const action=button.dataset.play,value=button.dataset.value;
    if(action==='check'){check();return;}
    if(action==='read'){(context.onRead??context.onNarrate)?.(`${task.title}。${task.prompt} ${state.hint?task.hints[state.hint-1]:''}`);return;}
    if(action==='short-set'){setRemaining=3;message='３もん あそぼう。いつでも おやすみできるよ。';renderPlay();return;}
    if(action==='next'){
      const tasks=tasksForUnit(unit),index=tasks.indexOf(task);
      const next=tasks[index+1];
      if(next)loadTask(next,true);else{message='このあそびを ひとまわり！ ほかのあそびや、つながるラボも えらべるよ。';renderPlay();}
      return;
    }
    if(action==='easier'){const tasks=tasksForUnit(unit),index=tasks.indexOf(task);loadTask(tasks[Math.max(0,index-1)]);return;}
    if(action==='recommended'){loadTask(recommendTask(LEARNING_TASKS,records,unit)??tasksForUnit(unit)[0]);return;}
    if(action==='restart'){loadTask(task);return;}
    if(action==='hint'){state.hint=Math.min(2,state.hint+1) as 1|2;recordAttempt(completed);renderPlay();return;}
    if(action==='undo'){
      const previous=edits.pop();if(previous){beginAnswerEdit();const hint=state.hint,support=state.support;state=previous;state.hint=hint;state.support=support;}
      renderPlay();return;
    }
    if(action==='choice'){if(state.choice!==Number(value))beginAnswerEdit();state.choice=Number(value);renderPlay();return;}
    if(action==='cell'){if(state.cell!==Number(value))beginAnswerEdit();state.cell=Number(value);renderPlay();return;}
    if(action==='piece'){state.piece=Number(value);renderPlay();return;}
    if(action==='move'){const directions={up:[0,-.5],down:[0,.5],left:[-.5,0],right:[.5,0]} as const;const d=directions[value as keyof typeof directions];if(d)move(d[0],d[1]);return;}
    if(action==='rotate' && task.kind==='compose'){
      const pose=state.poses[state.piece],next={...pose,rotation:(pose.rotation+90)%360};
      if(transformPolygon(task.pieces[state.piece].points,next).every(p=>p.x>=-1.5&&p.x<=7.5&&p.y>=-1.5&&p.y<=7.5)){beginAnswerEdit();rememberEdit();state.poses[state.piece]=next;}
      renderPlay();return;
    }
    if(action==='column' && task.kind==='build'){const cell=Number(value),blocks=editColumn(state.blocks,cell%3,Math.floor(cell/3),state.action);if(JSON.stringify(blocks)!==JSON.stringify(state.blocks)){beginAnswerEdit();rememberEdit();state.blocks=blocks;}renderPlay();return;}
    if(action==='action'){state.action=value as typeof state.action;renderPlay();return;}
    if(action==='view'){state.view=value as typeof state.view;if(task.kind==='build'&&task.mode==='copy')state.support=true;recordAttempt(completed);renderPlay();return;}
    if(action==='normalize'){state.normalized=true;state.support=true;}
    if(action==='align'){state.aligned=true;state.support=true;}
    if(action==='units'){state.units=true;state.support=true;}
    if(action==='reveal'){state.support=true;}
    recordAttempt(completed);renderPlay();
  },{signal:abort.signal});
  container.addEventListener('keydown',event=>{
    if(task.kind!=='compose' || !(event.target as Element).closest('.pre-stage'))return;
    const key=(event as KeyboardEvent).key;
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','r','R'].includes(key))return;
    event.preventDefault();
    if(key.toLowerCase()==='r'){get<HTMLButtonElement>('[data-play="rotate"]').click();return;}
    move(key==='ArrowLeft'?-.5:key==='ArrowRight'?.5:0,key==='ArrowUp'?-.5:key==='ArrowDown'?.5:0);
  },{signal:abort.signal});
  loadTask(task);
  return ()=>{recordAttempt(completed);abort.abort();container.replaceChildren();};
}
