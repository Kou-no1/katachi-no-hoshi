/** Readings for the authored interface. Keep readings local and reviewable. */
const READINGS: Record<string, string> = {
  見本: 'みほん', 基地: 'きち', 作品: 'さくひん', 制作: 'せいさく', 途中: 'とちゅう', 手前: 'てまえ', 黄色: 'きいろ', 丸: 'まる',
  作: 'つく', 飾: 'かざ', 戻: 'もど', 高: 'たか', 奥: 'おく', 取: 'と', 遊: 'あそ', 線: 'せん',
  学習記録: 'がくしゅうきろく', 研究所: 'けんきゅうじょ', 展開図: 'てんかいず',
  立方体: 'りっぽうたい', 図形: 'ずけい', 地図: 'ちず', 工房: 'こうぼう',
  建築: 'けんちく', 建物: 'たてもの', 三角: 'さんかく', 四角: 'しかく',
  何個: 'なんこ', 何度: 'なんど', 一度: 'いちど', 予想: 'よそう',
  回転: 'かいてん', 移動: 'いどう', 操作: 'そうさ', 矢印: 'やじるし',
  数字: 'すうじ', 点線: 'てんせん', 場所: 'ばしょ', 片方: 'かたほう',
  自由: 'じゆう', 自分: 'じぶん', 発見: 'はっけん', 正解: 'せいかい',
  成功: 'せいこう', 挑戦: 'ちょうせん', 十字: 'じゅうじ', 中心: 'ちゅうしん',
  右側: 'みぎがわ', 番号: 'ばんごう', 画面: 'がめん', 表示: 'ひょうじ',
  記録: 'きろく', 保存: 'ほぞん', 入力: 'にゅうりょく', 名前: 'なまえ',
  不要: 'ふよう', 先生: 'せんせい', 学年: 'がくねん', 学習: 'がくしゅう',
  試作: 'しさく', 外部: 'がいぶ', 送信: 'そうしん', 機能: 'きのう',
  端末: 'たんまつ', 設定: 'せってい', 未対応: 'みたいおう', 宇宙: 'うちゅう',
  冒険: 'ぼうけん', 部分: 'ぶぶん', 向: 'む', 面: 'めん', 辺: 'へん',
  形: 'かたち', 見: 'み', 動: 'うご', 選: 'えら', 置: 'お', 運: 'はこ',
  回: 'まわ', 度: 'ど', 合: 'あ', 長: 'なが', 上: 'うえ', 下: 'した',
  左: 'ひだり', 右: 'みぎ', 前: 'まえ', 後: 'あと', 数: 'かず',
  積: 'つ', 木: 'き', 何: 'なん', 先: 'さき', 考: 'かんが', 折: 'お',
  箱: 'はこ', 同: 'おな', 使: 'つか', 少: 'すこ', 別: 'べつ', 新: 'あたら',
  一: 'ひと', 星: 'ほし', 違: 'ちが', 方: 'かた', 小: 'ちい', 目: 'め',
  好: 'す', 学: 'まな', 競: 'きそ', 速: 'はや', 声: 'こえ', 異: 'こと',
  初: 'はじ', 子: 'こ', 確: 'たし', 分: 'わ', 手: 'て', 増: 'ふ',
  思: 'おも', 押: 'お', 変: 'か', 閉: 'と', 重: 'かさ', 直: 'なお',
  試: 'ため', 次: 'つぎ', 出: 'で', 指: 'ゆび',
};
const keys = Object.keys(READINGS).sort((a,b) => b.length-a.length);
const hasKanji = (value: string) => /[\p{Script=Han}々]/u.test(value);

export function readingSegments(text: string): { text: string; reading?: string }[] {
  const segments: { text: string; reading?: string }[] = [];
  let index = 0;
  while (index < text.length) {
    const word = keys.find(key => text.startsWith(key,index));
    if (!word) {
      const last = segments.at(-1);
      if (last && !last.reading) last.text += text[index];
      else segments.push({text:text[index]});
      index++;
      continue;
    }
    let reading = READINGS[word];
    if (word === '回' && /[0-9０-９一二三四五六七八九十]\s*$/u.test(text.slice(0,index))) reading = 'かい';
    if (word === '数' && text[index+1] === 'え') reading = 'かぞ';
    if (word === '何' && text[index+1] === 'を') reading = 'なに';
    if (word === '出' && text[index+1] === 'さ') reading = 'だ';
    segments.push({text:word,reading});
    index += word.length;
  }
  return segments;
}

/** Remove only pronunciation annotations, keeping the original Japanese wording. */
export function baseText(element: Element | null): string {
  if (!element) return '';
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('rt,rp').forEach(node => node.remove());
  return clone.textContent ?? '';
}

function annotate(root: Node) {
  const document = root.ownerDocument!;
  const nodes: Text[] = [];
  const add = (node: Node) => {
    if (node.nodeType !== Node.TEXT_NODE || !hasKanji(node.textContent ?? '')) return;
    const parent = node.parentElement;
    if (!parent || parent.closest('ruby,script,style,textarea,option,svg,[data-no-ruby]')) return;
    nodes.push(node as Text);
  };
  if (root.nodeType === Node.TEXT_NODE) add(root);
  else {
    const walker = document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node=walker.nextNode())) add(node);
  }
  for (const node of nodes) {
    const segments = readingSegments(node.data);
    if (!segments.some(segment=>segment.reading)) continue;
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (!segment.reading) { fragment.append(segment.text); continue; }
      const ruby = document.createElement('ruby');
      ruby.append(segment.text);
      const rt = document.createElement('rt');
      rt.textContent = segment.reading;
      rt.setAttribute('aria-hidden','true');
      ruby.append(rt);
      fragment.append(ruby);
    }
    node.replaceWith(fragment);
  }
}

/** Covers both initial markup and text inserted by missions, hints and feedback. */
export function observeFurigana(root: HTMLElement): () => void {
  annotate(root);
  const observer = new MutationObserver(records => {
    const targets = new Set<Node>();
    for (const record of records) {
      if (record.type === 'characterData') targets.add(record.target);
      else record.addedNodes.forEach(node=>targets.add(node));
    }
    targets.forEach(node=>{ if (root.contains(node)) annotate(node); });
  });
  observer.observe(root,{childList:true,characterData:true,subtree:true});
  return ()=>observer.disconnect();
}
