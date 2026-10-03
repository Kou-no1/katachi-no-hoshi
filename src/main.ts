import './style.css';
import { mountPuzzle } from './labs/puzzle';
import { mountBlockHub } from './labs/block-hub';
import { mountBox } from './labs/box';
import { readProgress, saveProgress } from './storage';
import type { LabId, MountLab } from './types';
import { baseText, observeFurigana } from './shared/furigana';

const app = document.getElementById('app')!;
const shapes = {
  puzzle: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M9 49V15h34Z" fill="#ed9a78"/><path d="M18 54h37V17Z" fill="#80b49d"/></svg>',
  blocks: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="m12 24 20-11 20 11-20 11Z" fill="#bad5c6"/><path d="M12 24v24l20 11V35Z" fill="#82b59f"/><path d="M32 35v24l20-11V24Z" fill="#4e8974"/><path d="m12 24 20 11 20-11M32 35v24" fill="none" stroke="#294f49" stroke-width="2" stroke-linejoin="round"/></svg>',
  box: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 6h16v16h16v16H40v20H24V38H8V22h16Z" fill="#89b5d1"/><path d="M24 22h16v16H24Zm0-16v16m16 0V6m-16 32v20m16-20v20" fill="none" stroke="#294f49" stroke-width="2" stroke-linejoin="round"/></svg>',
};

app.innerHTML = `
  <a class="skip-link" href="#lab-content">あそびにすすむ</a>
  <header class="site-header wrap">
    <a class="brand" href="#puzzle" aria-label="カタチのほし ホーム"><span class="brand-mark" aria-hidden="true">✦</span><span>カタチのほし<small>図形あそびの研究所</small></span></a>
    <div class="header-actions"><span class="prototype-label">はじめの３つのラボ</span><button class="button button-soft sound-toggle" type="button" aria-pressed="false">よみあげ：オフ</button></div>
  </header>
  <main class="wrap">
    <section class="welcome" aria-labelledby="welcome-title">
      <div><p class="eyebrow">小さな発見から、宇宙をつくろう。</p><h1 id="welcome-title">さわって、まわして、<br class="mobile-break">ひらめこう。</h1><p class="welcome-copy">かたちを動かして、自分の目でたしかめる。<br>好きなラボから、図形の冒険をはじめよう。</p></div>
      <div class="orbit-art" aria-hidden="true"><span class="orbit-ring"></span><span class="art-star a">✦</span><span class="art-star b">✧</span><div class="art-planet"><span></span></div><span class="art-square"></span><span class="art-triangle"></span></div>
    </section>
    <nav class="lab-nav" aria-label="あそぶラボをえらぶ">
      <button type="button" data-lab="puzzle" class="lab-card" aria-pressed="true"><span class="lab-icon">${shapes.puzzle}</span><span><small>01 / くみあわせる</small><strong>かたち工房</strong><span class="lab-caption">ぴったり、はまるかな？</span></span><span class="lab-arrow" aria-hidden="true">↗</span></button>
      <button type="button" data-lab="blocks" class="lab-card" aria-pressed="false"><span class="lab-icon">${shapes.blocks}</span><span><small>02 / みる向きをかえる</small><strong>ブロック建築</strong><span class="lab-caption">かくれたブロックを発見！</span></span><span class="lab-arrow" aria-hidden="true">↗</span></button>
      <button type="button" data-lab="box" class="lab-card" aria-pressed="false"><span class="lab-icon">${shapes.box}</span><span><small>03 / おってたしかめる</small><strong>はこづくり研究所</strong><span class="lab-caption">ひらいた形が、はこになる。</span></span><span class="lab-arrow" aria-hidden="true">↗</span></button>
    </nav>
    <section id="lab-content" class="lab-content" aria-label="図形のあそび"></section>
    <section class="discovery" aria-labelledby="discovery-title"><div><p class="eyebrow">YOUR DISCOVERIES</p><h2 id="discovery-title">ひらめきの記録</h2><p id="progress-copy" class="small-text"></p></div><div id="progress-stars" class="progress-stars" aria-label="ラボごとの記録"></div></section>
    <details class="adult-notes"><summary>おうちの方・先生へ</summary><div><p>この試作は、図形の動かしやすさと「予想して、たしかめる」学び方を試すための３つのラボです。学年や速さで競わず、何度でもやり直せます。</p><p>記録はこのブラウザに保存します。名前の入力は不要で、学習記録を外部に送信する機能はありません。よみあげの声は端末の設定によって異なります。</p><p>初めての子には「どうなると思う？」、確かめた後は「何を見て分かった？」と声をかけてみてください。</p><button type="button" id="reset-progress" class="button button-soft">ひらめきの記録をリセット</button></div></details>
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
const content = document.getElementById('lab-content')!;
const modules: Record<LabId, MountLab> = { puzzle: mountPuzzle, blocks: mountBlockHub, box: mountBox };
const names: Record<LabId, string> = { puzzle: 'かたち工房', blocks: 'ブロック建築', box: 'はこづくり研究所' };

function showProgress() {
  const count = Object.keys(progress.completed).length;
  document.getElementById('progress-copy')!.textContent = count ? `${count}このミッションをたしかめたよ。違う形にもチャレンジ！` : 'ミッションをたしかめると、ここに星が増えるよ。';
  document.getElementById('progress-stars')!.innerHTML = (Object.keys(names) as LabId[]).map(id => {
    const count = Object.keys(progress.completed).filter(key => key.startsWith(id + '-')).length;
    return `<div class="discovery-item ${count ? 'earned' : ''}"><span class="discovery-star" aria-hidden="true">${count ? '✦' : '✧'}</span><span>${names[id]}<small>${count ? count + 'こ発見' : 'これから発見'}</small></span></div>`;
  }).join('');
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

function openLab(id: LabId) {
  if (current === id) return;
  cleanup?.();
  current = id;
  content.innerHTML = '';
  document.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lab === id)));
  cleanup = modules[id](content, {
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    onNarrate: speak,
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
}

document.querySelectorAll<HTMLButtonElement>('[data-lab]').forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.lab as LabId;
    if (location.hash === '#' + id) openLab(id); else location.hash = id;
  });
});
window.addEventListener('hashchange', () => openLab(parseHash()));
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
