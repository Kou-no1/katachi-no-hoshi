import { projectBlocks, validateBuilding, type Block, type BlockView } from '../geometry/blocks';
import { matchConstruction } from '../geometry/construction';
import type { Answer, BuildTask, LearningTask, LengthTask, PatternTask, ShapeKind, ShapeToken, TaskBase, TaskLevel, UnitId } from './types';

const LEVELS: readonly TaskLevel[] = ['experience', 'experience', 'basic', 'basic', 'basic', 'basic', 'applied', 'applied', 'applied', 'applied', 'transfer', 'transfer'];
type Wording = Pick<TaskBase, 'title' | 'prompt' | 'hints' | 'explanation' | 'realActivity' | 'observe'>;
function base(unit: UnitId, index: number, wording: Wording): TaskBase {
  return { id: `preschool-${unit}-${String(index).padStart(2, '0')}`, version: 1, unit, level: LEVELS[index - 1], ...wording };
}
function token(shape: ShapeKind, rotation = 0, scale = 1): ShapeToken {
  return { shape, rotation, scale, color: '#81b8a2' };
}
const period: Record<ShapeKind, number> = { circle: 1, square: 90, rectangle: 180, triangle: 120, 'right-triangle': 360, l: 360, hexagon: 60 };
function sameToken(a: ShapeToken, b: ShapeToken): boolean {
  if (a.shape !== b.shape || a.color !== b.color || Math.abs(a.scale - b.scale) > 1e-9) return false;
  if (a.shape === 'circle') return true;
  const cycle = period[a.shape];
  const difference = ((a.rotation - b.rotation) % cycle + cycle) % cycle;
  return difference < 1e-9 || Math.abs(difference - cycle) < 1e-9;
}
function pattern(index: number, wording: Wording, unitPattern: ShapeToken[], repetitions: number, missing: number, options: ShapeToken[]): PatternTask {
  const expected = unitPattern[missing % unitPattern.length];
  return {
    ...base('P04', index, wording), kind: 'pattern', unitPattern,
    sequence: Array.from({ length: unitPattern.length * repetitions }, (_, position) => position === missing ? null : { ...unitPattern[position % unitPattern.length] }),
    options, answers: options.flatMap((option, i) => sameToken(option, expected) ? [i] : []),
  };
}

const patterns: readonly PatternTask[] = [
  pattern(1, {
    title: 'まる、さんかく、そのつぎは？', prompt: 'あいたところに はいる かたちを、ひとつ えらぼう。',
    hints: ['まる、さんかく、と じゅんばんに よんでみよう。', 'まるの つぎは、さんかく。あいたところの まえは まるだよ。'],
    explanation: 'まると さんかくの ふたつが、くりかえし ならんでいるよ。',
    realActivity: 'まると さんかくの かみを、こうごに ならべて みよう。', observe: 'ひとつずつ ゆびで さして、つぎの かたちを よそうするか。',
  }, [token('circle'), token('triangle')], 3, 3, [token('square'), token('triangle'), token('circle')]),
  pattern(2, {
    title: 'まるが ふたつ', prompt: 'まる、まる、しかく。あいたところの かたちは どれかな？',
    hints: ['おなじ かたちが、ふたつ つづいているよ。', 'まる、まる、しかくを、もういちど くりかえそう。'],
    explanation: 'まるが ふたつ、しかくが ひとつ。この みっつが ひとまとまりだよ。',
    realActivity: 'つみきを ふたつ、かみを ひとつ、の じゅんに ならべよう。', observe: 'ふたつ つづく まるを、とばさずに たどるか。',
  }, [token('circle'), token('circle'), token('square')], 2, 4, [token('circle'), token('square'), token('triangle')]),
  pattern(3, {
    title: 'しかくが ふたつ', prompt: 'さんかく、しかく、しかくの ならびを つづけよう。あいたところは どれかな？',
    hints: ['さんかくの あとは、しかくが ふたつだよ。', 'ふたつめの まとまりの、まんなかを みてみよう。'],
    explanation: 'さんかく、しかく、しかくの みっつが、くりかえしているね。',
    realActivity: 'かたちの カードを ３まいずつの まとまりに して、ならべよう。', observe: 'おなじ かたちが つづく ぶぶんも、ひとまとまりに するか。',
  }, [token('triangle'), token('square'), token('square')], 2, 4, [token('triangle'), token('circle'), token('square')]),
  pattern(4, {
    title: 'みっつの かたち', prompt: 'まる、さんかく、ろっかくの じゅんだよ。あいたところの かたちを えらぼう。',
    hints: ['ひとまとまりの さいごの かたちを みよう。', 'さんかくの つぎに あるのは、ろっかくの かたちだよ。'],
    explanation: 'ちがう かたちが みっつ、いつも おなじ じゅんばんで ならぶよ。',
    realActivity: '３しゅるいの ものを ならべて、どこで ひとまとまりか はなしてみよう。', observe: '３しゅるいの じゅんばんを、さきの まとまりにも つかうか。',
  }, [token('circle'), token('triangle'), token('hexagon')], 3, 5, [token('hexagon'), token('square'), token('circle')]),
  pattern(5, {
    title: 'ちいさい、おおきい', prompt: 'ちいさい まると、おおきい まるの くりかえしだよ。あいたところは どちらの おおきさかな？',
    hints: ['かたちは どちらも まる。おおきさを みてみよう。', 'おおきい まるの あとには、ちいさい まるが くるよ。'],
    explanation: 'おなじ まるでも、おおきさを かえると くりかえしを つくれるね。',
    realActivity: 'おおきい ふたと ちいさい ふたを、こうごに ならべよう。', observe: 'かたちと おおきさを、わけて くらべるか。',
  }, [token('circle', 0, .7), token('circle', 0, 1.15)], 3, 2, [token('circle', 0, 1.15), token('circle', 0, .7), token('square', 0, .7)]),
  pattern(6, {
    title: 'むきも くりかえす', prompt: 'ふたつの むきの さんかくが くりかえしているよ。あいたところと おなじ むきを えらぼう。',
    hints: ['まっすぐな ふたつの へんが、どちらを むくか みよう。', 'ひとつめと ふたつめの むきを、じゅんばんに くりかえすよ。'],
    explanation: 'おなじ かたちでも、むきを かえて じゅんばんを つくれるよ。',
    realActivity: 'さんかくの かみを、むきを かえて ２まいずつ ならべてみよう。', observe: 'むきが ちがうことに きづき、かたちだけで えらばないか。',
  }, [token('right-triangle', 0), token('right-triangle', 90)], 3, 3, [token('right-triangle', 180), token('right-triangle', 90), token('right-triangle', 0)]),
  pattern(7, {
    title: 'かぎの かたちが まわる', prompt: 'かぎの かたちの むきを、３こずつ くりかえそう。あいたところの むきは どれかな？',
    hints: ['でっぱっている ぶぶんを、ゆびで たどろう。', '３こで ひとまとまり。あいたところは、まとまりの ふたつめだよ。'],
    explanation: 'かたちは そのままで、むきの じゅんばんが くりかえしているよ。',
    realActivity: 'かぎの かたちに つないだ つみきを、３つの むきで ならべよう。', observe: 'かたちの でっぱりを てがかりに、むきの じゅんばんを たどるか。',
  }, [token('l', 0), token('l', 90), token('l', 180)], 3, 7, [token('l', 270), token('l', 180), token('l', 90)]),
  pattern(8, {
    title: '４こで ひとまとまり', prompt: 'まる、まる、さんかく、しかくの くりかえしだよ。あいたところに はいるものを えらぼう。',
    hints: ['はじめの ４こを、ひとまとまりに しよう。', 'まるが ふたつ つづいた あとは、たてと よこの へんが ある さんかくだよ。'],
    explanation: '４こで ひとまとまりに すると、ながい ならびも たどれるよ。',
    realActivity: '４まいの カードの まとまりを ふたつ つくり、１まいを かくして さがそう。', observe: 'ながい ならびを、４こずつに わけて かんがえるか。',
  }, [token('circle'), token('circle'), token('right-triangle'), token('square')], 2, 6, [token('right-triangle', 180), token('triangle'), token('right-triangle', 360)]),
  pattern(9, {
    title: 'ながしかくの ならび', prompt: 'あいたところの ながしかくを えらぼう。まわしても おなじに みえるものは、どちらでも いいよ。',
    hints: ['さんかく、ながしかく、ながしかく、ろっかくの ４こだよ。', 'ながい へんが、おなじ むきの ながしかくを さがそう。'],
    explanation: 'ながしかくは、はんぶん まわしても おなじに みえるよ。どちらも ならびに あうね。',
    realActivity: 'ながしかくの カードを はんぶん まわして、かたちが おなじか かさねよう。', observe: 'おなじに みえる ２つの こたえを、かさねて たしかめるか。',
  }, [token('triangle'), token('rectangle'), token('rectangle'), token('hexagon')], 2, 5, [token('rectangle', 180), token('square'), token('rectangle', 0), token('rectangle', 90)]),
  pattern(10, {
    title: 'おおきい しかくが ふたつ', prompt: 'おおきさの くりかえしを みて、あいたところに はいる しかくを えらぼう。おなじものは、どちらでも いいよ。',
    hints: ['ちいさいのが ひとつ、おおきいのが ふたつ、だよ。', 'あいたところの あとには、おおきい しかくが あるね。'],
    explanation: 'ちいさい、おおきい、おおきいの くりかえし。しかくは ４ぶんの１ まわしても おなじだよ。',
    realActivity: '２つの おおきさの しかくい かみで、３こずつの まとまりを つくろう。', observe: 'おおきさと むきを くらべ、ほんとうに おなじ こたえを みつけるか。',
  }, [token('square', 0, .65), token('square', 0, 1.05), token('square', 0, 1.05)], 3, 7, [token('square', 0, .65), token('square', 90, 1.05), token('square', 0, 1.05), token('rectangle', 0, 1.05)]),
  pattern(11, {
    title: 'はなれて おなじ かたち', prompt: 'はじめての ４この くりかえしだよ。あいたところの かたちを えらぼう。おなじものは、どちらでも いいよ。',
    hints: ['おなじ かぎの かたちが、ひとつ おきに でてくるよ。', 'ろっかく、かぎ、まる、かぎの ４こを、くりかえそう。'],
    explanation: 'おなじものが はなれていても、４こで ひとまとまりに できるね。',
    realActivity: '４まいの カードを すきな じゅんに して、おとなに つぎの まとまりを つくってもらおう。', observe: 'これまでと ちがう まとまりでも、くりかえしを みつけるか。',
  }, [token('hexagon'), token('l', 90), token('circle'), token('l', 90)], 3, 8, [token('hexagon', 60), token('triangle'), token('l', 90), token('hexagon', 0)]),
  pattern(12, {
    title: '４つの むきの じゅんばん', prompt: 'さんかくが ４つの むきで くりかえすよ。あいたところと おなじ むきを えらぼう。',
    hints: ['かどの ある ところが、どちらへ うつるか みよう。', '４こずつに わけると、あいたところは ３こめだよ。'],
    explanation: 'むきが ４つ かわって、はじめの むきに もどる くりかえしだね。',
    realActivity: 'さんかくの かみを ４ぶんの１ずつ まわして、４つの むきの カードを つくろう。', observe: 'はじめての ４つの むきでも、まとまりの どの ばしょかを つかうか。',
  }, [token('right-triangle', 0), token('right-triangle', 90), token('right-triangle', 180), token('right-triangle', 270)], 3, 10, [token('right-triangle', 0), token('right-triangle', 180), token('right-triangle', 90), token('l', 180)]),
];

function length(index: number, wording: Wording, rule: LengthTask['rule'], values: readonly [number, number][], referenceLength?: number): LengthTask {
  const rods = values.map(([rodLength, offset]) => ({ length: rodLength, offset, color: '#89b5d1' }));
  const expected = rule === 'longest' ? Math.max(...rods.map((rod) => rod.length)) : rule === 'shortest' ? Math.min(...rods.map((rod) => rod.length)) : referenceLength!;
  return { ...base('P14', index, wording), kind: 'length', rule, rods, ...(referenceLength === undefined ? {} : { referenceLength }), answers: rods.flatMap((rod, i) => rod.length === expected ? [i] : []) };
}

const lengths: readonly LengthTask[] = [
  length(1, {
    title: 'ながいほうは どれ？', prompt: 'ふたつの ぼうのうち、ながいほうを えらぼう。',
    hints: ['ひだりの はしは、そろっているよ。', 'みぎへ より のびているのは、どちらかな？'],
    explanation: 'はしを そろえると、ながさを くらべやすいね。', realActivity: '２ほんの ひもを、はしを そろえて くらべよう。', observe: 'はしを そろえたとき、のびている ほうを みつけるか。',
  }, 'longest', [[2, 0], [4, 0]]),
  length(2, {
    title: 'みじかいほうは どれ？', prompt: 'ふたつの ぼうのうち、みじかいほうを えらぼう。',
    hints: ['ながいものを さがす あそびとは、ちがうよ。', 'はしから はしまでの、きょりが すくない ほうだよ。'],
    explanation: 'みじかい ぼうは、はしを そろえると さきが てまえに あるよ。', realActivity: '２まいの かみの ほそい きれを、みじかいほうから ならべよう。', observe: 'ながい、みじかいの ことばに あわせて えらぶか。',
  }, 'shortest', [[3, 0], [1, 0]]),
  length(3, {
    title: '３ぼんを くらべよう', prompt: '３ぼんの なかで、いちばん ながい ぼうを えらぼう。',
    hints: ['ふたつずつ くらべてみても いいよ。', '３ぼんの うち、いちばん さきまで のびている ぼうだよ。'],
    explanation: 'ぜんぶの ぼうと くらべると、いちばん ながいものが わかるね。', realActivity: '３ぼんの ひもを、みじかい じゅんに ならべよう。', observe: 'さいしょの ２ほんだけで きめず、３ぼんめも くらべるか。',
  }, 'longest', [[3, 0], [5, 0], [4, 0]]),
  length(4, {
    title: 'いちばん みじかい', prompt: '３ぼんの なかで、いちばん みじかい ぼうを えらぼう。',
    hints: ['ひだりの はしから、みぎの はしまでを みよう。', 'いちばん すくない ながさの ぼうを さがそう。'],
    explanation: 'ながさが ちがう ３ぼんから、いちばん みじかいものを みつけたね。', realActivity: 'はしを そろえた ３ぼんの ぼうから、みじかいものを とろう。', observe: '３ぼんの なかで、いちばん みじかいものを みつけるか。',
  }, 'shortest', [[6, 0], [4, 0], [2, 0]]),
  length(5, {
    title: 'みほんと おなじ ながさ', prompt: 'みほんの ぼうと、おなじ ながさの ぼうを えらぼう。',
    hints: ['みほんと ひだりの はしを そろえてみよう。', 'みぎの はしも ぴったり あうものを さがそう。'],
    explanation: 'りょうほうの はしが あえば、おなじ ながさだよ。', realActivity: 'みほんの ひもと おなじ ながさの かみを、かさねて さがそう。', observe: 'ながいか みじかいか だけでなく、おなじ ながさを さがすか。',
  }, 'equal', [[2, 0], [3, 0], [4, 0]], 3),
  length(6, {
    title: 'はしが ずれていても', prompt: 'みほんと おなじ ながさの ぼうを えらぼう。ばしょが ずれていても、ながさは かわらないよ。',
    hints: ['「はしを そろえる」を つかってみよう。', 'みほんは ５つぶん。おなじ ５つぶんの ぼうを さがそう。'],
    explanation: 'ぼうの ばしょを かえても、はしから はしまでの ながさは おなじだよ。', realActivity: 'おなじ ながさの ひもを ずらして ならべ、そろえると おなじか たしかめよう。', observe: 'ずれた ばしょと、ぼうの ながさを わけて くらべるか。',
  }, 'equal', [[5, 1], [3, 0], [4, 2]], 5),
  length(7, {
    title: 'みぎの はしだけで きめない', prompt: 'いちばん ながい ぼうを えらぼう。みぎへ ずれているだけの ぼうも あるよ。',
    hints: ['みぎの はしだけでなく、ひだりの はしも みよう。', 'はしを そろえると、５つぶんの ぼうが いちばん ながいよ。'],
    explanation: 'いちばん みぎに ある はしと、いちばん ながい ぼうは、ちがうことが あるね。', realActivity: 'ながい ひもを ひだりへ、みじかい ひもを みぎへ ずらして、はしを そろえよう。', observe: 'みぎの はしの ばしょに つられず、ながさを くらべるか。',
  }, 'longest', [[4, 2], [5, 0], [3, 1]]),
  length(8, {
    title: 'そろえて たしかめよう', prompt: 'いちばん みじかい ぼうを えらぼう。ずれている ばしょに きをつけよう。',
    hints: ['ひだりの はしを そろえて くらべよう。', '３つぶん、４つぶん、５つぶん。いちばん すくないのは どれかな？'],
    explanation: 'みじかい ぼうでも、みぎへ ずらすと はしが さきに みえることが あるよ。', realActivity: '３しゅるいの かみの きれを ずらして ならべて、ながさを よそうしよう。', observe: 'そろえる まえと あとの みえかたを くらべるか。',
  }, 'shortest', [[3, 2], [4, 0], [5, 1]]),
  length(9, {
    title: 'おなじ ながさが ふたつ', prompt: 'みほんと おなじ ながさの ぼうを、ひとつ えらぼう。おなじものは、どちらでも いいよ。',
    hints: ['みほんは ４つぶんの ながさだよ。', 'ばしょが ちがっても、４つぶんの ぼうは おなじ ながさだね。'],
    explanation: '４つぶんの ぼうは ふたつあるよ。どちらを えらんでも みほんと おなじだね。', realActivity: 'おなじ ながさの かみを ２まい つくり、ちがう ばしょに ならべよう。', observe: 'ひとつ みつけた あとに、ほかにも おなじものが あると きづくか。',
  }, 'equal', [[4, 2], [6, 0], [4, 0], [3, 1]], 4),
  length(10, {
    title: 'ながいものが ふたつ', prompt: 'いちばん ながい ぼうを、ひとつ えらぼう。いちばん ながいものが ふたつなら、どちらでも いいよ。',
    hints: ['ながさが いちばん おおきい ぼうを さがそう。', '６つぶんの ぼうが ふたつあるよ。'],
    explanation: '６つぶんの ２ほんが、どちらも いちばん ながいね。', realActivity: 'おなじ ながい ひもを ２ほんと、みじかい ひもを ならべよう。', observe: 'いちばん ながいものが、ひとつとは かぎらないと きづくか。',
  }, 'longest', [[6, 0], [5, 2], [6, 1], [3, 2]]),
  length(11, {
    title: 'ちがう ならびでも', prompt: 'はじめての ならびから、いちばん みじかい ぼうを ひとつ えらぼう。おなじものは、どちらでも いいよ。',
    hints: ['どこに あるかではなく、ながさを くらべよう。', '２つぶんの ぼうは、どちらも いちばん みじかいよ。'],
    explanation: 'ずれた ならびでも、ながさを そろえて くらべる やりかたが つかえるね。', realActivity: 'おとなに ひもを ４ほん ならべてもらい、みじかいものを さがそう。', observe: 'あたらしい ならびにも、はしを そろえる やりかたを つかうか。',
  }, 'shortest', [[2, 2], [5, 0], [2, 0], [4, 1]]),
  length(12, {
    title: 'はじめての ７の ながさ', prompt: 'みほんと おなじ ながさの ぼうを、ひとつ えらぼう。おなじものは、どちらでも いいよ。',
    hints: ['みほんは ７つぶん。ひとつずつ かぞえても いいよ。', '８つぶんは ながすぎて、６つぶんは みじかすぎるね。'],
    explanation: 'あたらしい ながさでも、おなじ ひとつぶんで かぞえると くらべられるよ。', realActivity: 'おなじ おおきさの つみきを ７こ ならべて、おなじ ながさの かみを さがそう。', observe: 'はじめての ながさを、おなじ ひとつぶんの くりかえしで くらべるか。',
  }, 'equal', [[8, 0], [6, 2], [7, 1], [7, 0]], 7),
];

function columns(values: readonly [number, number][]): Block[] {
  return values.flatMap(([cell, height]) => Array.from({ length: height }, (_, y) => ({ x: cell % 3, y, z: Math.floor(cell / 3) })));
}
function build(index: number, wording: Wording, target: Block[], initial: Block[] = [], view: BuildTask['view'] = 'diagonal', projectionViews?: readonly BlockView[]): BuildTask {
  return {
    ...base('P17', index, wording), kind: 'build', target, initial, view,
    mode: projectionViews ? 'projections' : 'copy',
    ...(projectionViews ? { projections: Object.fromEntries(projectionViews.map((direction) => [direction, projectBlocks(target, direction)])) } : {}),
  };
}
const buildings: readonly BuildTask[] = [
  build(1, {
    title: 'ふたつを ならべよう', prompt: 'みほんと おなじ ばしょに、ブロックを ふたつ ならべよう。',
    hints: ['したの だんに、となりどうしで あるよ。', '★の ばしょに ひとつ、その みぎに ひとつ つもう。'],
    explanation: 'となりどうしの ふたつで、よこに ながい かたちが できたね。', realActivity: 'つみきを ふたつ、となりどうしに ならべて みよう。', observe: 'となりの ばしょを つかって、２こを ならべるか。',
  }, columns([[0, 1], [1, 1]]), [], 'top'),
  build(2, {
    title: 'ふたつを かさねよう', prompt: 'みほんと おなじように、まんなかに ブロックを ふたつ かさねよう。',
    hints: ['ばしょは ひとつ。たかさを みよう。', 'まんなかの ボタンを、２かい おしてみよう。'],
    explanation: 'ひとつの ばしょに ２こを かさねると、２だんの たてものに なるよ。', realActivity: '２この つみきを かさねて、よこから みよう。', observe: 'よこに ならべることと、うえに かさねることを わけるか。',
  }, columns([[4, 2]]), [], 'front'),
  build(3, {
    title: '３こを よこに', prompt: 'みほんと おなじ ばしょに、３この ブロックを よこに ならべよう。',
    hints: ['おくと てまえの あいだの ばしょを みてみよう。', 'おくと てまえの あいだの、ひだり・まんなか・みぎに １こずつだよ。'],
    explanation: '３つの ばしょに １こずつ ならべると、ながい たてものが できたね。', realActivity: '３この つみきを、１れつに ならべよう。', observe: 'ばしょの じゅんばんと、１こずつの たかさを そろえるか。',
  }, columns([[3, 1], [4, 1], [5, 1]])),
  build(4, {
    title: 'かどを つくろう', prompt: 'みほんと おなじ ばしょに、かどのある ３この たてものを つくろう。',
    hints: ['うえから みると、まがった かたちだよ。', '★、★の みぎ、★の ひとつ てまえに、１こずつ つもう。'],
    explanation: 'よこにも てまえにも のびて、かどのある かたちが できたね。', realActivity: '３この つみきで、まっすぐな ならびと まがった ならびを つくろう。', observe: 'うえからの みえかたを、９つの ばしょに うつせるか。',
  }, columns([[0, 1], [1, 1], [3, 1]]), [], 'top'),
  build(5, {
    title: 'とうを なおそう', prompt: 'つくりかけの とうを、みほんと おなじ ３だんに なおそう。',
    hints: ['まんなかの たかさが、１だん たりないよ。', 'まんなかに ひとつ つむと、３だんに なるね。'],
    explanation: '２だんに ひとつ たすと、３だんの とうに なったよ。', realActivity: 'おとなが ２だんの とうを つくり、こどもが ３だんに してみよう。', observe: 'ばしょを かえず、たりない たかさだけを なおすか。',
  }, columns([[4, 3]]), columns([[4, 2]]), 'front'),
  build(6, {
    title: 'ひろばを なおそう', prompt: 'ひとつ たりない ひろばを、みほんと おなじ ４こに なおそう。',
    hints: ['うえから みて、あいている ばしょを さがそう。', 'まんなかの ばしょに、ひとつ つむと しかくい ひろばに なるよ。'],
    explanation: 'あいていた ばしょを うめると、２こずつの しかくい ひろばに なったね。', realActivity: '２こずつ ならべた ４この つみきから、ひとつを とって もどしてみよう。', observe: 'すでに ある ブロックを かえず、あいている ばしょを みつけるか。',
  }, columns([[0, 1], [1, 1], [3, 1], [4, 1]]), columns([[0, 1], [1, 1], [3, 1]]), 'top'),
  build(7, {
    title: 'はなれた ふたつの とう', prompt: 'みほんと おなじ ばしょと たかさで、ふたつの とうを つくろう。',
    hints: ['とうの あいだには、あいた ばしょが あるよ。', '★と、いちばん みぎのおくに、２こずつ つもう。'],
    explanation: 'ばしょを ひとつ あけると、はなれた ふたつの とうに なったね。', realActivity: '２だんの とうを ふたつ つくり、あいだを あけて ならべよう。', observe: 'あいている ばしょも、みほんの てがかりに するか。',
  }, columns([[0, 2], [2, 2]])),
  build(8, {
    title: 'たかい ところを なおそう', prompt: 'みほんと くらべて、１だん たりない ところを なおそう。',
    hints: ['ひだりと まんなかは １だん。みぎの たかさを みよう。', 'おくと てまえの あいだの、みぎの ばしょに ひとつ つもう。'],
    explanation: 'たりない ところだけに たすと、みほんと おなじ たかさに なるよ。', realActivity: '３つの ばしょの うち ひとつだけを たかくして、ちがいを さがしてもらおう。', observe: 'ぜんぶを つくりなおさず、ちがう １れつの たかさを なおすか。',
  }, columns([[3, 1], [4, 1], [5, 3]]), columns([[3, 1], [4, 1], [5, 2]])),
  build(9, {
    title: 'ひとつ おおいよ', prompt: 'みほんより ひとつ おおい ブロックを、とって なおそう。',
    hints: ['よこや まえから みると、まんなかだけが たかいよ。', '「とる」を えらんで、まんなかの いちばん うえを とろう。'],
    explanation: 'まんなかの うえを とると、ぜんぶ １だんの じゅうじに なったね。', realActivity: 'じゅうじに ならべた つみきの まんなかに ひとつ かさねて、なおしてもらおう。', observe: 'たりないものを たすだけでなく、おおいものを とれるか。',
  }, columns([[1, 1], [3, 1], [4, 1], [5, 1], [7, 1]]), columns([[1, 1], [3, 1], [4, 2], [5, 1], [7, 1]])),
  build(10, {
    title: 'うえの だんを つくろう', prompt: 'したの だんは できているよ。みほんと おなじ うえの だんを つくろう。',
    hints: ['したの だんの ばしょは、そのままで いいよ。', '★と、いちばん みぎの おくに、ひとつずつ かさねよう。'],
    explanation: 'したの ４この うえに、２こを のせて、６この たてものに なったね。', realActivity: '４こで したの だんを つくり、りょうはしに １こずつ のせよう。', observe: 'したの だんと うえの だんを、わけて みるか。',
  }, columns([[0, 2], [1, 1], [2, 2], [4, 1]]), columns([[0, 1], [1, 1], [2, 1], [4, 1]])),
  build(11, {
    title: 'ふたつの ずから つくろう', prompt: 'まえと うえの ふたつの ずに あう たてものを つくろう。こたえは ひとつとは かぎらないよ。',
    hints: ['うえの ずで、ブロックの ある ばしょを きめよう。', 'まえの ずでは、ひだりが ２だんに みえるね。★か、★の ひとつ てまえの どちらを たかくしても いいよ。'],
    explanation: 'よこからの ずは でていないから、よこからの みえかたが ちがっても、ふたつの ずが あえば せいかいだよ。', realActivity: '３つの ばしょに つみきを ならべ、ひだりの ２つの ばしょの どちらを たかくするか かえてみよう。', observe: 'みえない ところを そうぞうし、ちがう つくりでも ずに あうと きづくか。',
  }, columns([[0, 1], [1, 1], [3, 2]]), [], 'diagonal', ['front', 'top']),
  build(12, {
    title: 'まえと よこから', prompt: 'まえと みぎよこの ふたつの ずに あう たてものを つくろう。みえる かたちが あえば せいかいだよ。',
    hints: ['まえからも よこからも、かたほうが ２だんに みえるよ。', '★の ばしょを ２だんにして、まんなかの ばしょに １こ おいてみよう。'],
    explanation: 'うえの ずは でていないから、ブロックの ある ばしょや かずが ちがう こたえも あるよ。', realActivity: '２だんの とうと １この つみきを つかい、まえと よこの みえかたを たしかめよう。', observe: 'ふたつの ずを りょうほう たしかめ、かくれた ばしょの ちがいを ゆるせるか。',
  }, columns([[0, 2], [1, 1], [3, 1], [4, 1]]), [], 'diagonal', ['front', 'side']),
];

export const CONTENT_B: readonly LearningTask[] = [...patterns, ...lengths, ...buildings];

/** Only the displayed information is assessed. A hidden example is never the target for a projection task. */
export function evaluateContentB(task: LearningTask, answer: Answer): boolean {
  if (!((task.unit === 'P04' && task.kind === 'pattern') || (task.unit === 'P14' && task.kind === 'length') || (task.unit === 'P17' && task.kind === 'build'))) return false;
  if (task.kind === 'pattern') {
    if (answer.kind !== 'choice' || !Number.isInteger(answer.index) || !task.options[answer.index] || !task.unitPattern.length) return false;
    const missing = task.sequence.flatMap((item, index) => item === null ? [index] : []);
    if (missing.length !== 1 || task.sequence.some((item, index) => item !== null && !sameToken(item, task.unitPattern[index % task.unitPattern.length]))) return false;
    return sameToken(task.options[answer.index], task.unitPattern[missing[0] % task.unitPattern.length]);
  }
  if (task.kind === 'length') {
    if (answer.kind !== 'choice' || !Number.isInteger(answer.index) || !task.rods[answer.index] || !task.rods.length) return false;
    const expected = task.rule === 'longest' ? Math.max(...task.rods.map((rod) => rod.length))
      : task.rule === 'shortest' ? Math.min(...task.rods.map((rod) => rod.length)) : task.referenceLength;
    return task.rods[answer.index].length === expected;
  }
  if (task.kind === 'build') {
    if (answer.kind !== 'build') return false;
    if (task.mode === 'copy') return matchConstruction(answer.blocks, task.target).matches;
    if (answer.blocks.length > 27 || validateBuilding(answer.blocks).length > 0 || !answer.blocks.every(({ x, y, z }) => [x, y, z].every((value) => Number.isInteger(value) && value >= 0 && value < 3))) return false;
    const views = Object.keys(task.projections ?? {}) as BlockView[];
    if (views.length !== 2) return false;
    return views.every((view) => {
      if (!['front', 'side', 'top'].includes(view) || !task.projections?.[view]) return false;
      const actual = new Set(projectBlocks(answer.blocks, view).map(({ u, v }) => `${u},${v}`));
      const expected = new Set(task.projections[view].map(({ u, v }) => `${u},${v}`));
      return actual.size === expected.size && [...expected].every((key) => actual.has(key));
    });
  }
  return false;
}
