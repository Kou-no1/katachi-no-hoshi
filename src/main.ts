import './style.css';
import { readProgress, saveProgress } from './storage';
import type { LabId, MountLab } from './types';
import { baseText, observeFurigana } from './shared/furigana';
import { LEARNING_LABS, labCompletedCount } from './curriculum';

const app = document.getElementById('app')!;

app.innerHTML = `
  <a class="skip-link" href="#lab-content">あそびにすすむ</a>
  <header class="site-header wrap">
    <a class="brand" href="#puzzle" aria-label="カタチのほし ホーム"><span class="brand-mark" aria-hidden="true">✦</span><span>カタチのほし<small>図形あそびの研究所</small></span></a>
    <div class="header-actions"><span class="prototype-label">６つのラボで、形の冒険</span><button class="button button-soft sound-toggle" type="button" aria-pressed="false">よみあげ：オフ</button></div>
  </header>
  <main class="wrap">
    <section class="welcome" aria-labelledby="welcome-title">
      <div><p class="eyebrow">小さな発見から、宇宙をつくろう。</p><h1 id="welcome-title">さわって、まわして、<br class="mobile-break">ひらめこう。</h1><p class="welcome-copy">かたちを動かして、自分の目でたしかめる。<br>好きなラボから、図形の冒険をはじめよう。</p></div>
      <div class="orbit-art" aria-hidden="true"><span class="orbit-ring"></span><span class="art-star a">✦</span><span class="art-star b">✧</span><div class="art-planet"><span></span></div><span class="art-square"></span><span class="art-triangle"></span></div>
    </section>
    <section class="learning-route" aria-label="あそびから空間を考えるまで"><p class="eyebrow">さわる → 作る → 考える</p><p class="small-text">はじめは１から。好きな場所にも、いつでも行けるよ。</p></section>
    <nav class="lab-nav" aria-label="あそぶラボをえらぶ">${LEARNING_LABS.map((lab,i)=>`<button type="button" data-lab="${lab.id}" class="lab-card" aria-pressed="${i===0}"><span class="lab-icon"><svg viewBox="0 0 64 64" aria-hidden="true">${lab.icon}</svg></span><span><small>${i+1} / ${lab.stage}</small><strong>${lab.name}</strong><span class="lab-caption">${lab.caption}</span><span class="lab-counter" data-lab-count="${lab.id}"></span></span><span class="lab-arrow" aria-hidden="true">↗</span></button>`).join('')}</nav>
    <section id="lab-content" class="lab-content" aria-label="図形のあそび"></section>
    <div class="next-adventure"><p class="small-text" id="journey-copy"></p><button type="button" class="button button-soft" id="next-lab">つぎのあそびへ</button></div>
    <section class="discovery" aria-labelledby="discovery-title"><div><p class="eyebrow">YOUR DISCOVERIES</p><h2 id="discovery-title">ひらめきの記録</h2><p id="progress-copy" class="small-text"></p></div><div id="progress-stars" class="progress-stars" aria-label="ラボごとの記録"></div></section>
    <details class="adult-notes"><summary>おうちの方・先生へ</summary><div><p>形の組み合わせや制作から、対称・量・投影図・回転体・切断へ進む６つのラボです。初めは大人と一緒に操作し、慣れたら新しい図で予想を確かめます。学年や速さで競わず、何度でもやり直せます。</p><p>記録と作品はこのブラウザに保存します。名前の入力は不要で、学習記録を外部に送信する機能はありません。よみあげの声は端末の設定によって異なります。</p><p>初めての子には「どうなると思う？」、確かめた後は「何を見て分かった？」と声をかけてみてください。</p><button type="button" id="reset-progress" class="button button-soft">ひらめきの記録をリセット</button></div></details>
  </main>
  <footer class="site-footer wrap"><span>✦ カタチのほし</span><span>あせらず、ためして、たしかめよう。</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  <dialog id="reset-dialog" class="reset-dialog" aria-labelledby="reset-title"><h2 id="reset-title">記録をリセットしますか？</h2><p>星の記録をリセットします。作った建物と制作途中は、基地からまたひらけます。</p><form method="dialog" class="button-row"><button type="submit" class="button button-soft" value="cancel">やめる</button><button type="submit" class="button button-primary" value="reset">リセットする</button></form></dialog>
`;
observeFurigana(app);

let progress = readProgress();
let cleanup: (() => void) | undefined;
let current: LabId | undefined;
let sound = false;
let toastTimer = 0;
let mountRequest = 0;
const content = document.getElementById('lab-content')!;
const modules: Record<LabId, () => Promise<MountLab>> = {
  puzzle:()=>import('./labs/puzzle').then(m=>m.mountPuzzle),
  blocks:()=>import('./labs/block-hub').then(m=>m.mountBlockHub),
  box:()=>import('./labs/box-hub').then(m=>m.mountBoxHub),
  transform:()=>import('./labs/transform').then(m=>m.mountTransform),
  reconstruction:()=>import('./labs/reconstruction').then(m=>m.mountReconstruction),
  solids:()=>import('./labs/solids').then(m=>m.mountSolids),
};
const names = Object.fromEntries(LEARNING_LABS.map(lab=>[lab.id,lab.name])) as Record<LabId,string>;

function showProgress() {
  const count = Object.keys(progress.completed).length;
  document.getElementById('progress-copy')!.textContent = count ? `${count}このミッションをたしかめたよ。違う形にもチャレンジ！` : 'ミッションをたしかめると、ここに星が増えるよ。';
  document.getElementById('progress-stars')!.innerHTML = (Object.keys(names) as LabId[]).map(id => {
    const count = Object.keys(progress.completed).filter(key => key.startsWith(id + '-')).length;
    return `<div class="discovery-item ${count ? 'earned' : ''}"><span class="discovery-star" aria-hidden="true">${count ? '✦' : '✧'}</span><span>${names[id]}<small>${count ? count + 'こ発見' : 'これから発見'}</small></span></div>`;
  }).join('');
  for(const lab of LEARNING_LABS){
    const count=labCompletedCount(lab.id,progress.completed);
    document.querySelector<HTMLElement>(`[data-lab-count="${lab.id}"]`)!.textContent=`${count} / ${lab.goal} ひらめき`;
  }
  const next=LEARNING_LABS.find(lab=>labCompletedCount(lab.id,progress.completed)<lab.goal);
  document.getElementById('journey-copy')!.textContent=next?`つぎの発見は「${next.name}」にもあるよ。何度でもためそう。`:'６つのラボのミッションをたしかめたね！ 別の作り方や、自由な作品にも挑戦しよう。';
}

function speak(text: string) {
  if (!sound || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  const voices = speechSynthesis.getVoices().filter(voice => voice.lang.toLowerCase().startsWith('ja'));
  utterance.voice = voices.find(voice => voice.localService) ?? voices[0] ?? null;
  utterance.rate = 0.9;
  speechSynthesis.speak(utterance);
}

async function openLab(id: LabId) {
  if (current === id) return;
  cleanup?.();
  cleanup=undefined;
  current = id;
  const request=++mountRequest;
  content.innerHTML = '<div class="panel" role="status">あそびをひらいているよ…</div>';
  document.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lab === id)));
  try {
  const mount = await modules[id]();
  if(request!==mountRequest)return;
  content.innerHTML='';
  cleanup = mount(content, {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    onNarrate: speak,
    getCompleted:()=>({...progress.completed}),
    onComplete(mission, label) {
      if (progress.completed[mission]) return;
      progress.completed[mission] = label;
      const saved = saveProgress(progress);
      showProgress();
      const toast = document.getElementById('toast')!;
      toast.textContent = saved ? '✦ 新しいひらめき！ 星を１つ見つけたよ。' : '✦ 新しいひらめき！ この画面を閉じるまで記録するよ。';
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3600);
      speak('新しいひらめき。星を一つ見つけたよ。');
    },
  });
  speak(`${names[id]}。${baseText(content.querySelector('.task-title'))} ${baseText(content.querySelector('.task-description'))}`);
  } catch {
    if(request!==mountRequest)return;
    content.innerHTML='<div class="panel"><p class="small-text">うまくひらけなかったよ。もういちどためしてみよう。</p><button type="button" class="button" id="retry-lab">もういちど</button></div>';
    content.querySelector('#retry-lab')!.addEventListener('click',()=>{current=undefined;void openLab(id);},{once:true});
  }
}

document.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.lab as LabId;
    if (location.hash === '#' + id) openLab(id); else location.hash = id;
  });
});
window.addEventListener('hashchange', () => openLab(parseHash()));
document.getElementById('next-lab')!.addEventListener('click',()=>{
  const index=LEARNING_LABS.findIndex(lab=>lab.id===current);
  const next=LEARNING_LABS[(index+1)%LEARNING_LABS.length].id;
  location.hash=next;document.getElementById('lab-content')!.scrollIntoView({behavior:'auto',block:'start'});
});
function parseHash(): LabId { const id = location.hash.slice(1); return Object.hasOwn(modules, id) ? id as LabId : 'puzzle'; }

const soundButton = document.querySelector<HTMLButtonElement>('.sound-toggle')!;
if (!('speechSynthesis' in window)) { soundButton.disabled = true; soundButton.textContent = 'よみあげ：未対応'; }
soundButton.addEventListener('click', () => {
  sound = !sound;
  soundButton.textContent = `よみあげ：${sound ? 'オン' : 'オフ'}`;
  soundButton.setAttribute('aria-pressed', String(sound));
  if (sound) speak(`${names[current ?? 'puzzle']}。${baseText(content.querySelector('.task-title'))} ${baseText(content.querySelector('.task-description'))}`);
  else speechSynthesis.cancel();
});
const resetDialog = document.getElementById('reset-dialog') as HTMLDialogElement;
document.getElementById('reset-progress')!.addEventListener('click', () => { resetDialog.returnValue=''; resetDialog.showModal(); });
resetDialog.addEventListener('close', () => {
  if (resetDialog.returnValue !== 'reset') return;
  progress = { version: 1, completed: {} };
  saveProgress(progress);
  showProgress();
  const id = current!;
  current = undefined;
  openLab(id);
});
showProgress();
openLab(parseHash());
