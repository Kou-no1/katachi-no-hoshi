/** Readings for the authored interface. Keep readings local and reviewable. */
const READINGS: Record<string, string> = {
  設計室: 'せっけいしつ', 対称: 'たいしょう', 拡大縮小: 'かくだいしゅくしょう', 面積: 'めんせき',
  表面積: 'ひょうめんせき', 体積: 'たいせき', 直方体: 'ちょくほうたい', 投影図: 'とうえいず', 復元: 'ふくげん',
  空間: 'くうかん', 中学: 'ちゅうがく', 変身: 'へんしん', 何倍: 'なんばい', 何行: 'なんぎょう', 倍率: 'ばいりつ',
  階段: 'かいだん', 距離: 'きょり', 完成: 'かんせい', 正方形: 'せいほうけい', 三角形: 'さんかくけい', 長方形: 'ちょうほうけい',
  左右: 'さゆう', 今度: 'こんど', 両方: 'りょうほう', 半分: 'はんぶん', 以上: 'いじょう', 整数: 'せいすう', 単位: 'たんい',
  確認: 'かくにん', 回転体: 'かいてんたい', 切断: 'せつだん', 断面: 'だんめん', 円柱: 'えんちゅう', 円錐: 'えんすい', 球: 'きゅう',
  直角三角形: 'ちょっかくさんかくけい', 直角: 'ちょっかく', 半円: 'はんえん', 直径: 'ちょっけい', 頂点: 'ちょうてん',
  六角形: 'ろっかくけい', 正六角形: 'せいろっかくけい', 平面: 'へいめん', 輪郭: 'りんかく', 角度: 'かくど',
  対角線: 'たいかくせん', 斜め: 'ななめ', 交点: 'こうてん', 正面: 'しょうめん', 高さ: 'たかさ', 長さ: 'ながさ', 半径: 'はんけい',
  立体: 'りったい', 研究: 'けんきゅう', 課題: 'かだい', 透明: 'とうめい', 表示中: 'ひょうじちゅう',
  読: 'よ', 鏡: 'かがみ', 倍: 'ばい', 横: 'よこ', 縦: 'たて', 行: 'ぎょう', 色: 'いろ', 順: 'じゅん',
  大人: 'おとな', 一緒: 'いっしょ', 組: 'く', 慣: 'な', 進: 'すす',
  注目: 'ちゅうもく', 切り口: 'きりくち', 緑: 'みどり', 点: 'てん', 円: 'えん', 本: 'ほん', 通: 'とお', 交: 'まじ',
  近: 'ちか', 遠: 'とお', 離: 'はな', 空: 'あ', 大: 'おお', 比: 'くら', 表: 'あらわ', 消: 'け', 探: 'さが', 入: 'い',
  草: 'くさ', 青: 'あお', 夕焼: 'ゆうや', 赤: 'あか', 軸: 'じく', 角: 'かど', 細: 'ほそ', 弧: 'こ', 端: 'はし',
  図: 'ず', 覚: 'おぼ', 外: 'そと', 広: 'ひろ', 量: 'りょう', 答: 'こた', 切: 'き',
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
    if (word === '分' && /マス\s*$/u.test(text.slice(0,index))) reading = 'ぶん';
    if (word === '入' && text[index+1] === 'っ') reading = 'はい';
    if (word === '入' && text[index+1] === 'る') reading = 'はい';
    if (word === '行' && /^[くけ]/u.test(text.slice(index+1))) reading = 'い';
    if (word === '本' && /[3３]\s*$/u.test(text.slice(0,index))) reading = 'ぼん';
    if (word === '本' && /[168１６８]\s*$/u.test(text.slice(0,index))) reading = 'ぽん';
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
