// 町の道順：目印・覚え方のコツ・地図と道順の作り方。画面（index.html）と検査（qa/run.mjs）の両方から使う。
// 今日の3本・上級は日本時間の日付から作る乱数で決まり、だれでも同じ。ブラウザの乱数は練習ととことんだけ。
// ここを変えると過去の日の地図も変わる。変えた PR に一言書く。
(function (root) {
  "use strict";
  // [id, 絵, 名前]。id は記録（目印帳）に残るので、変えない・消さない（足すのは最後に）
  const MARKS = [
    ["post", "📮", "郵便局"], ["bank", "🏦", "銀行"], ["hospital", "🏥", "病院"], ["school", "🏫", "学校"],
    ["park", "🌳", "公園"], ["shrine", "⛩️", "神社"], ["bakery", "🍞", "パン屋"], ["fish", "🐟", "魚屋"],
    ["veg", "🥬", "八百屋"], ["ramen", "🍜", "ラーメン屋"], ["sushi", "🍣", "すし屋"], ["cafe", "☕", "喫茶店"],
    ["barber", "💈", "床屋"], ["flower", "🌸", "花屋"], ["books", "📚", "本屋"], ["store", "🏪", "コンビニ"],
    ["gas", "⛽", "ガソリンスタンド"], ["fire", "🚒", "消防署"], ["police", "🚓", "交番"], ["hotel", "🏨", "ホテル"],
    ["library", "📖", "図書館"], ["cake", "🎂", "ケーキ屋"], ["bath", "♨️", "銭湯"], ["station", "🚉", "駅"],
    ["bus", "🚏", "バス停"], ["parking", "🅿️", "駐車場"], ["drug", "💊", "薬局"], ["glasses", "👓", "めがね屋"],
    ["shoes", "👟", "くつ屋"], ["laundry", "🧺", "クリーニング店"], ["bento", "🍱", "弁当屋"], ["clock", "⌚", "時計屋"],
    ["toys", "🧸", "おもちゃ屋"], ["tea", "🍵", "お茶屋"], ["super", "🛒", "スーパー"], ["bike", "🚲", "自転車屋"],
    ["meat", "🥩", "肉屋"], ["church", "⛪", "教会"], ["pool", "🏊", "プール"], ["music", "🎵", "音楽教室"],
    ["vet", "🐾", "動物病院"], ["oden", "🍢", "おでん屋"],
  ];
  const BY = {}; MARKS.forEach((m, i) => { BY[m[0]] = { id: m[0], e: m[1], n: m[2], i }; });
  const IDS = MARKS.map((m) => m[0]);

  // 覚え方のコツ（毎日1つ）。道を覚える練習でよく使われる方法：目印と向きを組にする・言葉にする・数える・形で見る
  // ex(route) は今日の1本目で使う例。見えている道の組み立て方だけを示す
  const TIPS = [
    { id: "mark", t: "目印で覚える", d: "「どの目印の角で、右か左か」を組にして覚えます。", ex: (r) => (r.turns[0] ? `${BY[r.turns[0].m].n}の角を${r.turns[0].d}` : "") },
    { id: "count", t: "曲がる回数を数える", d: "先に「全部で何回曲がるか」を覚えると、抜けに気づけます。", ex: (r) => `曲がるのは 全部で${r.turns.length}回` },
    { id: "voice", t: "声に出して言う", d: "右・左を声に出すと、目で見るだけより残りやすくなります。", ex: (r) => r.turns.map((t) => t.d).join("・") },
    { id: "walk", t: "歩く向きで考える", d: "地図の上下でなく、自分が歩いている向きで右・左を考えます。", ex: () => "" },
    { id: "story", t: "お話にする", d: "目印をつないで、道のりを短いお話にします。", ex: (r) => r.turns.slice(0, 2).map((t) => BY[t.m].n).join("に寄って、") + "へ" },
    { id: "shape", t: "道の形を見る", d: "道全体を「L」や「コ」のような形として思いうかべます。", ex: () => "" },
    { id: "goal", t: "目的地の方向を先に見る", d: "家から見て、目的地がどちらにあるかを先に覚えます。", ex: (r) => `目的地は 家から見て${dirWord(r)}` },
  ];

  // ---- 乱数（同じ種ならどの端末でも同じ）----
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(arr, R) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const pick = (arr, R) => arr[Math.floor(R() * arr.length)];

  // 地図の大きさ（交差点の列×行）。幅320pxでも交差点の間が44px以上になるよう、横は6列まで
  const sizeFor = (turns) => (turns <= 2 ? [5, 5] : turns <= 4 ? [5, 6] : turns <= 6 ? [6, 7] : [6, 8]);
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  // 右・左（画面は下向きが y の正。東から南へ曲がると右）
  const turnWord = (a, b) => (a[0] * b[1] - a[1] * b[0] > 0 ? "右" : "左");
  // 交差点 (x,y) に接する区画（区画 (bx,by) は交差点 (bx,by)〜(bx+1,by+1) に囲まれた四角）
  function blocksAt(x, y, cols, rows) { const out = []; for (const [bx, by] of [[x - 1, y - 1], [x, y - 1], [x - 1, y], [x, y]]) if (bx >= 0 && by >= 0 && bx < cols - 1 && by < rows - 1) out.push(bx + "," + by); return out; }

  // 1本の道：家の前の交差点から、turns 回曲がって目的地へ。曲がる角と目的地には、必ずその角に接する目印を置く
  function makeRoute(R, turns, avoid = []) {
    const [cols, rows] = sizeFor(turns);
    for (let tries = 0; tries < 500; tries++) {
      const path = [], seen = new Set();
      let x = Math.floor(R() * cols), y = Math.floor(R() * rows);
      path.push([x, y]); seen.add(x + "," + y);
      let d = pick(DIRS, R), ok = true;
      const tns = [];
      for (let seg = 0; seg <= turns && ok; seg++) {
        if (seg > 0) { const nd = shuffled(DIRS.filter((q) => q[0] * d[0] + q[1] * d[1] === 0), R); d = nd.find((q) => { const nx = x + q[0], ny = y + q[1]; return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !seen.has(nx + "," + ny); }); if (!d) { ok = false; break; } tns.push({ i: path.length - 1 }); }
        let room = 0; for (let k = 1; ; k++) { const nx = x + d[0] * k, ny = y + d[1] * k; if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen.has(nx + "," + ny)) break; room = k; }
        if (room < 1) { ok = false; break; }
        const len = 1 + Math.floor(R() * Math.min(room, 3));
        for (let k = 0; k < len; k++) { x += d[0]; y += d[1]; path.push([x, y]); seen.add(x + "," + y); }
      }
      if (!ok || tns.length !== turns || path.length < turns + 3) continue;
      // 曲がる向き
      for (const t of tns) { const a = path[t.i - 1], b = path[t.i], c = path[t.i + 1]; t.d = turnWord([b[0] - a[0], b[1] - a[1]], [c[0] - b[0], c[1] - b[1]]); }
      // 目印の場所：家・曲がる角・目的地の区画は全部ちがう区画
      const used = new Set(), bl = {};
      const take = (p) => { const c = shuffled(blocksAt(p[0], p[1], cols, rows), R).filter((b) => !used.has(b)); if (!c.length) return null; used.add(c[0]); return c[0]; };
      const home = take(path[0]); if (!home) continue;
      const tb = tns.map((t) => take(path[t.i])); if (tb.includes(null)) continue;
      const goalB = take(path[path.length - 1]); if (!goalB) continue;
      // 目印の名前：曲がる角と目的地は、avoid（同じ日のほかの道の曲がる角・目的地の目印）と重ねない
      const pool = shuffled(IDS.filter((id) => !avoid.includes(id)), R), rest = shuffled(IDS, R);
      const names = []; const nm = () => { const id = pool.find((q) => !names.includes(q)) || rest.find((q) => !names.includes(q)); names.push(id); return id; };
      tns.forEach((t, j) => { t.m = nm(); bl[tb[j]] = t.m; });
      const goal = nm(); bl[goalB] = goal;
      // ほかの区画にも、半分ほど目印を置く（まよう手がかり）。同じ地図に同じ目印は1つだけ
      for (let by = 0; by < rows - 1; by++) for (let bx = 0; bx < cols - 1; bx++) { const b = bx + "," + by; if (!used.has(b) && b !== home && R() < 0.55) { const id = rest.find((q) => !names.includes(q)); if (id) { names.push(id); bl[b] = id; } } }
      return { cols, rows, path, turns: tns, blocks: bl, home, goal };
    }
    throw new Error("道を作れませんでした: " + turns);
  }
  // 家から見た目的地の方向（ことば）
  function dirWord(r) { const a = r.path[0], b = r.path[r.path.length - 1], dx = b[0] - a[0], dy = b[1] - a[1]; const v = dy < 0 ? "上" : dy > 0 ? "下" : "", h = dx > 0 ? "右" : dx < 0 ? "左" : ""; return (h && v ? h + v : h || v || "すぐそば") + (h || v ? "のほう" : ""); }
  // 曲がる角までの道のりを、ことばで（「パン屋の角を右」）
  const words = (r) => [...r.turns.map((t) => ({ e: BY[t.m].e, s: `${BY[t.m].n}の角を${t.d}` })), { e: BY[r.goal].e, s: `${BY[r.goal].n}に着く` }];

  // あとで思い出す：1本目の道で曲がった角の目印を、同じ地図のほかの目印とまぜて選ぶ
  function makeRecall(R, of, trips) {
    const r = trips[of], want = r.turns.map((t) => t.m), onMap = Object.values(r.blocks).filter((id) => !want.includes(id));
    const size = want.length <= 3 ? 6 : 9, others = shuffled(IDS.filter((id) => !want.includes(id) && !onMap.includes(id)), R);
    const foil = shuffled(onMap, R).slice(0, size - want.length);
    return { k: "recall", of, items: want.slice(), shelf: shuffled([...want, ...foil, ...others].slice(0, size), R) };
  }
  const walk = (R, turns, avoid) => ({ k: "walk", ...makeRoute(R, turns, avoid) });
  // 今日の道：曲がる回数 2・3・4 の3本と、最後に1本目の曲がり角を思い出す
  const DAILY = [2, 3, 4], HARD = [5, 6];
  function dailyList(k) {
    const R = rng(seedOf("d:" + k)), trips = [];
    for (const n of DAILY) trips.push(walk(R, n, trips.flatMap((t) => [...t.turns.map((x) => x.m), t.goal])));
    return [...trips, makeRecall(R, 0, trips)];
  }
  // 上級：曲がる回数 5・6 の2本（道のりのことばは出さない）と、1本目の曲がり角を思い出す
  function hardList(k) {
    const R = rng(seedOf("h:" + k)), trips = [];
    for (const n of HARD) trips.push(walk(R, n, trips.flatMap((t) => [...t.turns.map((x) => x.m), t.goal])));
    return [...trips, makeRecall(R, 0, trips)];
  }
  // 練習・とことん（毎回ちがう。ブラウザの乱数を使う）
  // 道が作れなかったら同じ曲がる回数で作り直す（選んだ回数どおりの道だけを返す）。20回だめなときだけ1つ減らして、練習・とことんを止めない
  const freeWalk = (n) => { for (let k = n; ; k--) for (let i = 0; i < (k === n ? 20 : 3); i++) { try { return walk(Math.random, k, []); } catch (e) { if (k <= 1 && i === 2) throw e; } } };
  const TIP_OF = (k, EPOCH) => TIPS[Math.max(0, Math.round((Date.parse(k) - Date.parse(EPOCH)) / 864e5)) % TIPS.length];

  root.MM = { MARKS, BY, IDS, TIPS, TIP_OF, seedOf, rng, shuffled, sizeFor, blocksAt, turnWord, makeRoute, makeRecall, dailyList, hardList, freeWalk, words, dirWord, DAILY, HARD };
  if (typeof module !== "undefined") module.exports = root.MM;
})(typeof window !== "undefined" ? window : globalThis);
