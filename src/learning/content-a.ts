import { convexIntersection, polygonArea, transformPolygon } from '../geometry/puzzle';
import type { Point, PiecePose } from '../geometry/puzzle';
import type { Answer, ComposeTask, LearningTask, PositionTask, ShapeTask, ShapeToken, TaskBase, TaskLevel, UnitId } from './types';

const CORAL = '#f19b79';
const MINT = '#81b8a2';
const BLUE = '#89b5d1';
const GOLD = '#e6c573';
const COLORS = [CORAL, MINT, BLUE, GOLD];

function base(unit: UnitId, number: number, title: string, prompt: string, hints: readonly [string, string], explanation: string, realActivity: string, observe: string): TaskBase {
  const level: TaskLevel = number <= 2 ? 'experience' : number <= 6 ? 'basic' : number <= 10 ? 'applied' : 'transfer';
  return { id: `preschool-${unit}-${String(number).padStart(2, '0')}`, version: 1, unit, level, title, prompt, hints, explanation, realActivity, observe };
}

const token = (shape: ShapeToken['shape'], rotation = 0, color = CORAL, scale = 1): ShapeToken => ({ shape, rotation, color, scale });

const SHAPES: readonly ShapeTask[] = [
  {
    ...base('P01', 1, 'くるっと まるい', 'みほんのように、かどのない まるを えらぼう。どれを えらんでも、まるなら だいじょうぶ。',
      ['へりを、ゆびで ぐるっと たどってみよう。', 'とがった かどが あるかな？ ないかな？'],
      'いろや おおきさが ちがっても、かどのない まるは まるの なかまだね。',
      'びんの ふたを いくつか ならべて、まるい へりを ゆびで たどろう。',
      'いろではなく、かどの あり・なしを たしかめるかを みる。'),
    kind: 'shape', reference: token('circle'),
    options: [token('circle', 0, MINT, 0.7), token('triangle', 0, CORAL), token('rectangle', 90, BLUE), token('circle', 0, BLUE, 1.25)], answers: [0, 3],
  },
  {
    ...base('P01', 2, 'ななめでも ましかく', 'みほんと おなじ、ましかくの なかまを えらぼう。ななめの むきでも いいよ。',
      ['へんの ながさを みくらべよう。', 'よっつの へんが おなじ ながさで、かどは おなじ かたちだね。'],
      'まわしても、よっつの おなじ ながさの へんは かわらないよ。',
      'ましかくの おりがみを まわして、かどや へんが かわらないことを たしかめよう。',
      'ななめの ましかくを、べつの かたちだと おもっていないかを みる。'),
    kind: 'shape', reference: token('square'),
    options: [token('square', 45, MINT, 0.8), token('triangle', 0, BLUE), token('rectangle', 90, CORAL), token('square', 0, GOLD, 1.2)], answers: [0, 3],
  },
  {
    ...base('P01', 3, 'かどが みっつ', 'かどが みっつある、さんかくの なかまを えらぼう。ほそい さんかくも なかまだよ。',
      ['かどを、ひとつずつ ゆびで さしてみよう。', 'いち、に、さん。みっつで もとの ばしょに もどるかな？'],
      'へんや かどの かたちが ちがっても、かどが みっつなら さんかくの なかまだよ。',
      'ちがう かたちの さんかくを かみに かき、かどに シールを はろう。',
      'みほんと そっくりで なくても、かどの かずで なかまを えらべるかを みる。'),
    kind: 'shape', reference: token('triangle'),
    options: [token('right-triangle', 90, MINT, 0.8), token('square', 0, CORAL), token('triangle', 180, GOLD, 1.2), token('circle', 0, BLUE)], answers: [0, 2],
  },
  {
    ...base('P01', 4, 'たてながも よこながも', 'みほんのような、ながしかくの なかまを えらぼう。たてでも よこでも いいよ。',
      ['ながい へんと、みじかい へんが あるかな？', 'むかいの へんどうしが おなじ ながさの、ながしかくだよ。'],
      'むきが かわっても、ながい へんと みじかい へんの ある かたちは おなじ なかまだね。',
      'ほんを たてと よこに むけて、ひょうしの へりを みくらべよう。',
      'たてながと よこながを、おなじ ながしかくの なかまと とらえるかを みる。'),
    kind: 'shape', reference: token('rectangle'),
    options: [token('rectangle', 90, MINT, 0.9), token('square', 45, BLUE), token('rectangle', 180, GOLD, 0.7), token('hexagon', 0, CORAL)], answers: [0, 2],
  },
  {
    ...base('P01', 5, 'いろに まどわされない', 'みほんと おなじ いろでなくても いいよ。かどのない まるを えらぼう。',
      ['いろを いちど わすれて、へりを みよう。', 'おなじ いろでも、かどが あれば まるでは ないね。'],
      'いろは かたちの なまえを きめないよ。ちいさい まるも、おおきい まるも まるだね。',
      'いろの ちがう まるい ふたと、しかくい ふたを かたちで わけよう。',
      'みほんと おなじ いろの しかくに ひかれず、へりの とくちょうを みるかを みる。'),
    kind: 'shape', reference: token('circle', 0, MINT, 1.2),
    options: [token('square', 0, MINT, 1.2), token('circle', 0, CORAL, 0.6), token('right-triangle', 0, MINT), token('circle', 0, BLUE, 1.1)], answers: [1, 3],
  },
  {
    ...base('P01', 6, 'さんかくの むきいろいろ', 'かどが みっつある なかまを えらぼう。さかさまでも、ちいさくても だいじょうぶ。',
      ['とがっている むきではなく、かどの かずを みよう。', 'へりを いっしゅうして、かどを みっつ みつけよう。'],
      'さんかくは、むきや おおきさが かわっても かどが みっつだよ。',
      'かみに かいた さんかくを きって、さかさまや ななめに ならべよう。',
      'さかさまの さんかくや、かどの かたちが ちがう さんかくも えらべるかを みる。'),
    kind: 'shape', reference: token('right-triangle', 270, CORAL),
    options: [token('triangle', 30, BLUE, 0.6), token('rectangle', 30, MINT), token('triangle', 210, GOLD, 1.2), token('right-triangle', 0, MINT, 0.9)], answers: [0, 2, 3],
  },
  {
    ...base('P01', 7, 'おおきさより へん', 'ましかくの なかまを えらぼう。おおきい かたちが、ぜんぶ ましかくとは かぎらないよ。',
      ['おおきさを くらべるまえに、へんを みよう。', 'よっつの へんは、ぜんぶ おなじ ながさかな？'],
      'ちいさい ましかくも なかま。ながい へんと みじかい へんが ある かたちは、ながしかくだね。',
      'おおきさの ちがう おりがみと、ながしかくの かみを ならべて わけよう。',
      'おおきさを そろえなくても、へんの とくちょうで ましかくを えらべるかを みる。'),
    kind: 'shape', reference: token('square', 45, CORAL, 0.7),
    options: [token('rectangle', 45, CORAL, 1.2), token('square', 180, BLUE, 0.65), token('square', 0, MINT, 1.25), token('l', 90, GOLD)], answers: [1, 2],
  },
  {
    ...base('P01', 8, 'へこんだ かたち', 'みほんのように、かどが ひとつ へこんだ かたちを えらぼう。むきが ちがっても いいよ。',
      ['へりを たどって、なかへ まがる ばしょを さがそう。', 'くぼみの ある かたちを、あたまの なかで まわしてみよう。'],
      'まわしても、おおきさが かわっても、へこんだ かどが のこるね。',
      'かみの かどを ひとつ きりとって、くぼみの ある かたちを まわしてみよう。',
      'かどの かずだけでなく、へこみの ある・なしを みるかを みる。'),
    kind: 'shape', reference: token('l', 90),
    options: [token('l', 270, MINT, 0.7), token('hexagon', 30, CORAL), token('right-triangle', 0, BLUE), token('l', 0, GOLD, 1.2)], answers: [0, 3],
  },
  {
    ...base('P01', 9, 'むっつの かどと へこみ', 'かどが むっつで、へこんだ かどの ない なかまを えらぼう。',
      ['まずは かどを むっつ かぞえてみよう。', 'かどが むっつでも、なかへ へこんだ ばしょが あれば べつの なかまだよ。'],
      'かどの かずと、へこみの ないことを、ふたつとも たしかめられたね。',
      'ろっかくの かみと、へこんだ かみを ならべて、へりを たどろう。',
      'かどの かずだけで えらばず、へこみも たしかめるかを みる。'),
    kind: 'shape', reference: token('hexagon', 30),
    options: [token('l', 0, CORAL), token('hexagon', 90, MINT, 0.8), token('hexagon', 0, BLUE, 1.2), token('square', 0, GOLD)], answers: [1, 2],
  },
  {
    ...base('P01', 10, 'しかくの なかまを あつめる', 'まっすぐな へんが よっつ、かどが よっつの なかまを えらぼう。ましかくも ながしかくも いいよ。',
      ['ながい・みじかいより、へんと かどの かずを みよう。', 'へりを いっしゅうして、よっつの かどが あれば なかまだね。'],
      'ましかくと ながしかくは ちがう とくちょうも あるけれど、どちらも しかくの なかまだよ。',
      'おりがみと ほんの ひょうしを ならべ、どちらも かどが よっつあることを たしかめよう。',
      'ひとつの なまえだけで なく、ひろい なかまに まとめられるかを みる。'),
    kind: 'shape', reference: token('rectangle'),
    options: [token('square', 45, MINT), token('rectangle', 90, BLUE, 0.8), token('hexagon', 0, GOLD), token('l', 0, CORAL)], answers: [0, 1],
  },
  {
    ...base('P01', 11, 'おさらの なかま', 'おさらのように、かどが なくて まるい なかまを えらぼう。かどが たくさんある かたちにも きをつけてね。',
      ['まるく みえても、へりが まっすぐな ところは ないかな？', 'へりが ずっと なめらかで、かどが なければ まるだね。'],
      'かどが たくさんある かたちと、かどのない まるを みわけられたね。',
      'まるい おさらと、かどの ある おぼんを さわって、へりを くらべよう。',
      'みなれた ものの かたちを、へりの とくちょうで せつめいできるかを みる。'),
    kind: 'shape', reference: token('circle'),
    options: [token('circle', 0, MINT, 0.75), token('hexagon', 30, CORAL), token('l', 180, BLUE), token('circle', 0, GOLD, 1.2)], answers: [0, 3],
  },
  {
    ...base('P01', 12, 'まどを かたちで わける', 'おうちの まどに ありそうな、かどが よっつの なかまを えらぼう。いろや むきは きにしなくて いいよ。',
      ['ほんものの まどの、かどを おもいだそう。', 'たてなが、よこなが、ましかく。どれも かどが よっつなら なかまだね。'],
      'みのまわりの ものも、かどや へんを みると かたちの なかまに わけられるよ。',
      'へやの まどや ほんを さがし、かどが よっつの ものを あつめよう。',
      'がめんの かたちと、へやの ものの かたちを つなげて せつめいするかを みる。'),
    kind: 'shape', reference: token('square', 0, BLUE),
    options: [token('rectangle', 90, GOLD), token('triangle', 180, BLUE), token('square', 45, CORAL, 0.8), token('rectangle', 0, MINT, 1.15)], answers: [0, 2, 3],
  },
];

const rectangle = (width: number, height: number): Point[] => [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
const triangle = (width: number, height: number): Point[] => [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: 0, y: height }];
const pose = (x: number, y: number, rotation = 0): PiecePose => ({ x, y, rotation });
const pieces = (points: Point[][], initials: PiecePose[]) => points.map((shape, index) => ({ points: shape, color: COLORS[index], initial: initials[index] }));

const COMPOSITIONS: readonly ComposeTask[] = [
  {
    ...base('P05', 1, 'ながい しかくを つくる', 'ふたつの さんかくを あわせて、よこながの てんせんを うめよう。かさならないように してね。',
      ['てんせんの ながい へんに、さんかくの ながい へんを あわせてみよう。', 'ひとつを はんぶん まわして、ななめの へんどうしを あわせよう。'],
      'ふたつの さんかくが、すきまも かさなりも なく、よこながの しかくに なったね。',
      'よこながの かみを ななめに きって、ふたつの さんかくから もとに もどそう。',
      'へんを あわせるとき、かさなりと すきまを みなおすかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([triangle(3, 2), triangle(3, 2)], [pose(0, 4.5), pose(3.5, 4.5)]), solution: [pose(1, 0), pose(4, 2, 180)],
  },
  {
    ...base('P05', 2, 'ながしかくから ましかく', 'ふたつの ながしかくを つかって、ましかくの てんせんを うめよう。',
      ['ひとつだけでは、てんせんの ぜんぶを うめられないね。', 'ながい へんどうしを あわせると、どんな かたちに なるかな？'],
      'ながしかくを ふたつ あわせると、ましかくも つくれるね。たてに ならべる つくりかたも あるよ。',
      'おりがみを はんぶんに きって、たてにも よこにも ならべなおそう。',
      'ひとつの ならべかたに こだわらず、べつの むきも ためすかを みる。'),
    kind: 'compose', target: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }],
    pieces: pieces([rectangle(2, 1), rectangle(2, 1)], [pose(0, 4.5), pose(4.5, 4.5, 90)]), solution: [pose(2, 0), pose(2, 1)],
  },
  {
    ...base('P05', 3, 'たての まど', 'ほそい ピースを たてに して、まどの てんせんを うめよう。',
      ['ピースを くるっと まわして、ながい へんの むきを みよう。', 'たてに した ピースを、となりどうしに ならべよう。'],
      'ふたつの ほそい ピースが、たてながの ひとつの しかくに なったね。',
      'ほそい かみを ふたつ つくり、となりに ならべて まどの かたちに しよう。',
      'ピースの ながい へんを、てんせんの むきに あわせるかを みる。'),
    kind: 'compose', target: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 2, y: 3 }],
    pieces: pieces([rectangle(1, 3), rectangle(1, 3)], [pose(0, 5.5, 270), pose(3.5, 6.5, 270)]), solution: [pose(2, 0), pose(3, 0)],
  },
  {
    ...base('P05', 4, 'みっつの ピース', 'みっつの ピースを ぜんぶ つかって、よこに ひろい てんせんを うめよう。',
      ['ひとつ いれたあと、のこった すきまを みよう。', 'ほそい ピースを、となりに ひとつずつ ならべると どうかな？'],
      'みっつの ピースを ならべると、もとの ピースより ひろい しかくに なるね。',
      'おなじ ほそい かみを みっつ ならべ、ぜんぶで ひとつの かたちに しよう。',
      'すきまに あう ピースを つぎつぎ えらぶかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([rectangle(1, 2), rectangle(1, 2), rectangle(1, 2)], [pose(0, 4.5), pose(2, 4.5), pose(4, 4.5)]), solution: [pose(1, 0), pose(2, 0), pose(3, 0)],
  },
  {
    ...base('P05', 5, 'さんかくを おおきく', 'ふたつの さんかくを あわせて、ひとつの おおきな さんかくを つくろう。',
      ['おおきな さんかくの、とがった ところを みよう。', 'まっすぐな へんどうしを あわせて、ななめの へんを そとに しよう。'],
      'ちいさな さんかくから、かたちの ちがう おおきな さんかくも つくれるね。',
      'おなじ さんかくの かみを ふたつ ならべ、そとの へりが さんかくになる ばしょを さがそう。',
      'ピースの ななめの へんを、そとの へりとして つかうかを みる。'),
    kind: 'compose', target: [{ x: 3, y: 0 }, { x: 5, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([triangle(2, 2), triangle(2, 2)], [pose(0, 4.5), pose(4, 4.5)]), solution: [pose(3, 2, 180), pose(3, 2, 270)],
  },
  {
    ...base('P05', 6, 'しかくと さんかく', 'しかくと さんかくを あわせて、かたほうが ななめの てんせんを うめよう。',
      ['てんせんの ななめの へんは、どの ピースに あるかな？', 'まず さんかくの ななめの へんを あわせて、のこりを しかくで うめよう。'],
      'ちがう かたちの ピースでも、へんを あわせると ひとつの かたちに なるね。',
      'ましかくと さんかくの かみを あわせ、そとの へりを なぞろう。',
      'そとの へんを てがかりに、どの ピースを つかうか きめるかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([rectangle(2, 2), [{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]], [pose(0, 4.5), pose(4, 4.5)]), solution: [pose(1, 0), pose(3, 0)],
  },
  {
    ...base('P05', 7, 'にだんに つなぐ', 'よっつの ピースを、となりにも うえにも つないで、たてながの てんせんを うめよう。',
      ['よこに ならべるだけで、てんせんの たかさに とどくかな？', 'ふたつずつ ならべて、その うえにも ならべてみよう。'],
      'となりに ならべることと、うえに ならべることを あわせて、ひとつの しかくが できたね。',
      'おなじ ピースを よっつ つくり、にだんに ならべて かみの まどを つくろう。',
      'よこだけでなく、たての すきまも みて ならべるかを みる。'),
    kind: 'compose', target: [{ x: 2, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 2, y: 4 }],
    pieces: pieces([rectangle(1, 2), rectangle(1, 2), rectangle(1, 2), rectangle(1, 2)], [pose(0, 4.5), pose(1.5, 4.5), pose(3, 4.5), pose(4.5, 4.5)]), solution: [pose(2, 0), pose(3, 0), pose(2, 2), pose(3, 2)],
  },
  {
    ...base('P05', 8, 'さんかくだけで うめる', 'さんかくを みっつ つかって、ななめの へんが ある てんせんを うめよう。',
      ['ふたつの さんかくで、しかくを つくれるかな？', 'しかくを つくってから、のこった ななめの ところに もうひとつ つなごう。'],
      'さんかくから しかくを つくり、その しかくに もうひとつ あわせる つくりかたも あるね。',
      'さんかくの かみを みっつ つかい、ふたつを まとめてから もうひとつ つなごう。',
      'ふたつの ピースを、ひとつの しかくとして まとめて みるかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([triangle(2, 2), triangle(2, 2), triangle(2, 2)], [pose(0, 4.5), pose(2, 4.5), pose(4, 4.5)]), solution: [pose(1, 0), pose(3, 2, 180), pose(3, 2, 270)],
  },
  {
    ...base('P05', 9, 'ななめの おび', 'ふたつの さんかくの むきを かえて、ななめに のびた てんせんを うめよう。',
      ['てんせんには、ななめの へんが ふたつあるね。', 'ななめの へんを そとに、まっすぐな へんを なかで あわせよう。'],
      'まわす むきを かえると、さんかくから ななめの おびも できるね。',
      'ふたつの さんかくを くるくる まわし、ななめの へんが そとに のこる ならべかたを さがそう。',
      'ひとつの ピースだけでなく、ふたつの むきの くみあわせを かんがえるかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 3, y: 0 }, { x: 5, y: 2 }, { x: 3, y: 2 }],
    pieces: pieces([triangle(2, 2), triangle(2, 2)], [pose(0, 4.5), pose(4, 4.5)]), solution: [pose(3, 0, 90), pose(3, 2, 270)],
  },
  {
    ...base('P05', 10, 'はばが ちがう ピース', 'ほそい ピースと ひろい ピースを あわせて、おおきな ながしかくを つくろう。',
      ['ながい へんを、おなじ むきに そろえてみよう。', 'ひろい ピースを いれたあと、ほそい ピースで のこりの はばを うめよう。'],
      'はばが ちがっても、ながさを そろえて ならべると ひとつの しかくに なるね。',
      'はばの ちがう かみを みっつ ならべて、ながい へんの はしを そろえよう。',
      'ながい へんを そろえながら、のこった はばを みるかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 3 }, { x: 1, y: 3 }],
    pieces: pieces([rectangle(1, 3), rectangle(1, 3), rectangle(2, 3)], [pose(0, 4.5, 270), pose(3.5, 5.5, 270), pose(0, 6.5, 270)]), solution: [pose(1, 0), pose(2, 0), pose(3, 0)],
  },
  {
    ...base('P05', 11, 'ほんの ひょうし', 'しかくと ふたつの さんかくで、ほんの ひょうしのような てんせんを うめよう。',
      ['ひょうしの ながい へんを、おもいだしてみよう。', 'ふたつの さんかくを まとめると、しかくの ピースと ならべやすく なるよ。'],
      'ちがう ピースを まとめると、みのまわりの ながしかくも つくれるね。',
      'ほんの ひょうしの うえに、しかくと さんかくの かみを、すきまなく ならべよう。',
      'がめんで ためした まとめかたを、ほんの ひょうしと かみでも つかうかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 2 }, { x: 1, y: 2 }],
    pieces: pieces([rectangle(2, 2), triangle(2, 2), triangle(2, 2)], [pose(0, 4.5), pose(2.5, 4.5), pose(5, 4.5)]), solution: [pose(1, 0), pose(3, 0), pose(5, 2, 180)],
  },
  {
    ...base('P05', 12, 'さんかくの はた', 'よっつの さんかくを あわせて、おおきな はたの てんせんを うめよう。',
      ['はたの かどから、ピースを ひとつずつ あわせてみよう。', 'そとの かどが うまったら、なかの すきまに あう むきを さがそう。'],
      'そとの かどと、なかの すきまの りょうほうを みると、おおきな さんかくも つくれるね。',
      'さんかくの はたを かみに かき、ちいさな さんかくを よっつ ならべて うめよう。',
      'そとの へりだけでなく、なかに のこった すきまも みなおすかを みる。'),
    kind: 'compose', target: [{ x: 1, y: 0 }, { x: 5, y: 0 }, { x: 1, y: 4 }],
    pieces: pieces([triangle(2, 2), triangle(2, 2), triangle(2, 2), triangle(2, 2)], [pose(0, 4.5), pose(2, 4.5), pose(4.5, 4.5), pose(4, 6.5, 180)]), solution: [pose(1, 0), pose(3, 0), pose(1, 2), pose(3, 2, 180)],
  },
];

const anchors = (box: number, tree: number, house: number): PositionTask['anchors'] => [
  { cell: box, icon: 'box', label: 'はこ' }, { cell: tree, icon: 'tree', label: 'き' }, { cell: house, icon: 'house', label: 'いえ' },
];
const viewpoint = (observer: PositionTask['observer']) => `みるひとは ずの${observer === 'bottom' ? 'した' : 'うえ'}に いて、ずのまんなかを みているよ。みぎ・ひだりは そのひとから。うえ・したは、ずのうえ・しただよ。`;

const POSITIONS: readonly PositionTask[] = [
  {
    ...base('P10', 1, 'みぎと した', `${viewpoint('bottom')} はこの みぎで、きより ずのしたの、あいている マスを えらぼう。`,
      ['まず、みるひとの みぎが どちらか たしかめよう。', 'はこの みぎを さがしてから、きより したかも みよう。'],
      'みぎと したの、ふたつの やくそくに あう マスを えらべたね。',
      'ゆかに はこと きの おもちゃを おき、みぎと したを かみに かいた ずで さがそう。',
      'ひとつの やくそくだけでなく、ふたつを たしかめるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(3, 1, 8), observer: 'bottom', answers: [4, 5, 7],
  },
  {
    ...base('P10', 2, 'ひだりと うえ', `${viewpoint('bottom')} はこの ひだりで、きより ずのうえの、あいている マスを えらぼう。`,
      ['はこから、みるひとの ひだりを さがそう。', 'そこは、きより ずで うえにも なっているかな？'],
      'ひだりと うえを、べつべつに たしかめると みつけやすいね。',
      'かみの マスに おもちゃを おき、ひだりで うえに なる ばしょを ゆびで さそう。',
      'みぎ・ひだりと、ずの うえ・したを、くべつして つかうかを みる。'),
    kind: 'position', size: 3, anchors: anchors(5, 7, 0), observer: 'bottom', answers: [1, 3, 4],
  },
  {
    ...base('P10', 3, 'ふたつで ひとつに しぼる', `${viewpoint('bottom')} はこの みぎで、きより ずのうえの、あいている マスを えらぼう。`,
      ['はこの みぎには、いくつかの マスが あるね。', 'きより うえか、ものの ある マスでは ないかも みよう。'],
      'ふたつの やくそくと、あいていることを たしかめると、ひとつに しぼれたね。',
      '３つの おもちゃを マスに おき、ふたつの やくそくで ひとつの ばしょを さがそう。',
      'ものが おいてある マスを、こたえから はずせるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(4, 6, 2), observer: 'bottom', answers: [5],
  },
  {
    ...base('P10', 4, 'あいている ひだり', `${viewpoint('bottom')} はこの ひだりで、きより ずのしたの、あいている マスを えらぼう。`,
      ['はこの ひだりから さがしてみよう。', 'きより したでも、いえが あったら おけないね。'],
      'いえの ある マスを のぞいて、ふたつの やくそくに あう ばしょが みつかったね。',
      'かみの うえに おもちゃの いえも おいて、あいている ばしょを さがそう。',
      'いえを てがかりや じゃまな ばしょとして、ずに いれて かんがえるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(4, 2, 6), observer: 'bottom', answers: [3],
  },
  {
    ...base('P10', 5, 'おなじ よこの だん', `${viewpoint('bottom')} はこの みぎで、いえと おなじ よこのだんの、あいている マスを えらぼう。`,
      ['いえから よこに のびる だんを みよう。', 'その だんの なかで、はこの みぎに なる マスを さがそう。'],
      'おなじ よこのだんと、みぎの やくそくを あわせて たしかめたね。',
      'おもちゃの いえから よこに ひもを おき、おなじ だんを たしかめよう。',
      'よこのだんを、たての れつと とりちがえないかを みる。'),
    kind: 'position', size: 3, anchors: anchors(0, 8, 4), observer: 'bottom', answers: [5],
  },
  {
    ...base('P10', 6, 'おなじ たての れつ', `${viewpoint('bottom')} はこより ずのうえで、きと おなじ たてのれつの、あいている マスを えらぼう。`,
      ['きから まっすぐ たてに のびる れつを みよう。', 'その れつの なかで、はこより うえの マスを さがそう。'],
      'たてのれつと、ずの うえを あわせて ばしょを きめられたね。',
      'マスの ずに きの おもちゃを おき、たてに ひもを そえて れつを たしかめよう。',
      'おなじ れつという ことばを、うえ・したの マスに つなげるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(8, 4, 0), observer: 'bottom', answers: [1],
  },
  {
    ...base('P10', 7, 'うえから みる みぎ', `${viewpoint('top')} はこの みぎで、きより ずのうえの、あいている マスを えらぼう。`,
      ['みるひとが、ずの うえに いるね。からだの むきを かんがえよう。', 'そのひとの みぎは、ずでは ひだりがわだよ。うえ・したは ずのままだよ。'],
      'みるひとの ばしょが かわると、みぎは ずの ひだりがわに なるね。ずの うえは かわらないよ。',
      'かみの マスの うえがわに ぬいぐるみを おき、その ぬいぐるみの みぎを さがそう。',
      'みるひとからの みぎと、ずの うえを わけて たしかめるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(5, 7, 0), observer: 'top', answers: [1, 3, 4],
  },
  {
    ...base('P10', 8, 'むこうの ひとの ひだり', `${viewpoint('top')} はこの ひだりで、きより ずのしたの、あいている マスを えらぼう。`,
      ['みるひとは、こちらに むかって みているよ。', 'そのひとの ひだりは、ずでは みぎがわ。そこから、きより したを さがそう。'],
      'そのひとの ひだりを かんがえてから、ずの したも たしかめられたね。',
      'おもちゃを はさんで むかいあい、あいての ひだりと じぶんの ひだりを くらべよう。',
      'じぶんの ひだりのまま えらばず、みるひとの ばしょを みなおすかを みる。'),
    kind: 'position', size: 3, anchors: anchors(3, 1, 8), observer: 'top', answers: [4, 5, 7],
  },
  {
    ...base('P10', 9, 'むきを かえて おなじ だん', `${viewpoint('top')} いえの みぎで、きと おなじ よこのだんの、あいている マスを えらぼう。`,
      ['まず、きと おなじ よこのだんを さがそう。', 'いえの みぎは、みるひとの みぎ。ずでは ひだりがわに なるね。'],
      'だんは ずで みて、みぎは みるひとから かんがえると、ふたつの やくそくが あうね。',
      'むかいあう ぬいぐるみと いえを かみに おき、おなじ だんの ばしょを さがそう。',
      'おなじだんの てがかりを のこしながら、みる むきを かえられるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(0, 4, 8), observer: 'top', answers: [3],
  },
  {
    ...base('P10', 10, 'うえは ずで みる', `${viewpoint('top')} きの ひだりで、はこより ずのうえの、あいている マスを えらぼう。`,
      ['きの ひだりは、みるひとから みて どちらかな？', 'みるひとが うえに いても、ずの うえ・したは そのままだよ。'],
      'みるひとからの ひだりと、ずで みた うえを、べつべつに つかえたね。',
      'マスの かみに うえ・したの しるしを つけ、ぬいぐるみを うえに おいて たしかめよう。',
      'みる むきを かえても、ずの うえ・したを ひっくりかえさないかを みる。'),
    kind: 'position', size: 3, anchors: anchors(6, 4, 2), observer: 'top', answers: [5],
  },
  {
    ...base('P10', 11, 'おさんぽの やくそく', `${viewpoint('bottom')} おさんぽの ばしょは、いえの みぎで、きより ずのした。あいている マスを えらぼう。`,
      ['いえの みぎに ある ばしょを、ずで さがそう。', 'きより したか、はこで ふさがっていないかも たしかめよう。'],
      'ふたつの やくそくに あう あいた ばしょは、ひとつとは かぎらないね。どれも つかえるよ。',
      '３つの ものを ゆかに おいて ずを かき、おさんぽの ばしょを ふたつの やくそくで きめよう。',
      'ひとつ みつけたあとも、ほかに やくそくに あう ばしょが あると わかるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(7, 2, 3), observer: 'bottom', answers: [4, 5, 8],
  },
  {
    ...base('P10', 12, 'ぬいぐるみの おねがい', `${viewpoint('top')} ぬいぐるみから みて、はこの ひだりで、きより ずのうえ。あいている マスに おもちゃを おこう。`,
      ['ぬいぐるみは、ずの うえから こちらを みているね。', 'ぬいぐるみの ひだりを さがして、きより うえで、いえの ない マスを えらぼう。'],
      'じぶんではなく、ぬいぐるみからの ひだりを かんがえて、ふたつの やくそくに あう ばしょを きめられたね。',
      'ぬいぐるみを マスの かみの うえに おき、おもちゃの おきばを ふたつの やくそくで つたえよう。',
      'ほんものの ぬいぐるみの ばしょからも、みぎ・ひだりを かんがえられるかを みる。'),
    kind: 'position', size: 3, anchors: anchors(1, 6, 5), observer: 'top', answers: [2],
  },
];

export const CONTENT_A: readonly LearningTask[] = [...SHAPES, ...COMPOSITIONS, ...POSITIONS];

function compositionMatches(task: ComposeTask, poses: PiecePose[]): boolean {
  if (poses.length !== task.pieces.length || poses.some((item) => ![item.x, item.y, item.rotation].every(Number.isFinite) || !Number.isInteger(item.rotation / 90))) return false;
  const polygons = task.pieces.map((piece, index) => transformPolygon(piece.points, poses[index]));
  const epsilon = 1e-7;
  if (polygons.some((polygon) => polygon.some((point) => point.x < -epsilon || point.y < -epsilon || point.x > 6 + epsilon || point.y > 6 + epsilon))) return false;
  let coveredArea = 0;
  for (let index = 0; index < polygons.length; index += 1) {
    const area = polygonArea(polygons[index]);
    const inside = polygonArea(convexIntersection(polygons[index], task.target));
    if (area <= epsilon || Math.abs(area - inside) > epsilon) return false;
    coveredArea += inside;
    for (let other = index + 1; other < polygons.length; other += 1) {
      if (polygonArea(convexIntersection(polygons[index], polygons[other])) > epsilon) return false;
    }
  }
  return Math.abs(coveredArea - polygonArea(task.target)) <= epsilon;
}

/** Answers are zero-based. Composition grading accepts every geometric cover. */
export function evaluateContentA(task: LearningTask, answer: Answer): boolean {
  if (task.kind === 'shape' && answer.kind === 'choice') {
    return Number.isInteger(answer.index) && answer.index >= 0 && answer.index < task.options.length && task.answers.includes(answer.index);
  }
  if (task.kind === 'position' && answer.kind === 'position') {
    return Number.isInteger(answer.cell) && answer.cell >= 0 && answer.cell < 9
      && !task.anchors.some((anchor) => anchor.cell === answer.cell) && task.answers.includes(answer.cell);
  }
  if (task.kind === 'compose' && answer.kind === 'compose') return compositionMatches(task, answer.poses);
  return false;
}
