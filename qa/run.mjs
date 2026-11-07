// 町の道順の検査。道の作り方（3年分の今日・上級と、練習・とことんを何千本）・通しで遊ぶ・まちがい・行きすぎ・ヒント・続きから・
// 上級・練習・とことん・思い出し・実績・カレンダーとあとから・古いタブ・言い方・幅320px・PWA・引き継ぎ・見やすさを見る。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 600) });
const M = createRequire(import.meta.url)(path.join(root, "gen.js"));
const dayKey = (n) => new Date(Date.UTC(2026, 10, 5 + n)).toISOString().slice(0, 10);

// 1. 道の作り方（ブラウザを使わない）
function routeProblems(r, turns) {
  const bad = [], { cols, rows, path: p } = r;
  if (cols > 6) bad.push("横が7列以上（幅320pxで交差点の間が44pxより狭い）");
  const seen = new Set();
  p.forEach(([x, y], i) => {
    if (x < 0 || y < 0 || x >= cols || y >= rows) bad.push("地図の外");
    if (seen.has(x + "," + y)) bad.push("同じ交差点を2回通る"); seen.add(x + "," + y);
    if (i && Math.abs(x - p[i - 1][0]) + Math.abs(y - p[i - 1][1]) !== 1) bad.push("となりでない交差点へ飛ぶ");
  });
  // 曲がる所を数え直す（向きが変わる交差点）
  const real = [];
  for (let i = 1; i < p.length - 1; i++) { const a = [p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]], b = [p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]]; if (a[0] !== b[0] || a[1] !== b[1]) real.push({ i, d: a[0] * b[1] - a[1] * b[0] > 0 ? "右" : "左" }); }
  if (real.length !== turns || r.turns.length !== turns) bad.push(`曲がる回数 ${real.length}/${r.turns.length}（${turns} のはず）`);
  if (JSON.stringify(real) !== JSON.stringify(r.turns.map((t) => ({ i: t.i, d: t.d })))) bad.push("曲がる角・右左が道と合わない");
  const near = (b, q) => { const [bx, by] = b.split(",").map(Number); return [[bx, by], [bx + 1, by], [bx, by + 1], [bx + 1, by + 1]].some(([x, y]) => x === q[0] && y === q[1]); };
  const blockOf = (id) => Object.keys(r.blocks).find((b) => r.blocks[b] === id);
  for (const t of r.turns) { const b = blockOf(t.m); if (!b || !near(b, p[t.i])) bad.push("曲がる角に、その目印が接していない"); }
  if (!near(blockOf(r.goal) || "-9,-9", p[p.length - 1])) bad.push("目的地が道の終わりに接していない");
  if (!near(r.home, p[0])) bad.push("家が道の始まりに接していない");
  const ids = Object.values(r.blocks);
  if (new Set(ids).size !== ids.length) bad.push("同じ地図に同じ目印が2つ");
  if (r.blocks[r.home]) bad.push("家の区画に目印がある");
  if (ids.some((id) => !M.BY[id])) bad.push("知らない目印");
  return bad;
}
{
  const bad = [];
  for (let d = 0; d < 365 * 3; d++) {
    const k = dayKey(d);
    for (const [nm, L, T] of [["今日", M.dailyList(k), M.DAILY], ["上級", M.hardList(k), M.HARD]]) {
      const walks = L.filter((t) => t.k === "walk");
      if (walks.length !== T.length || L[L.length - 1].k !== "recall") { bad.push(`${k} ${nm}: 本数`); continue; }
      walks.forEach((r, j) => routeProblems(r, T[j]).forEach((p) => bad.push(`${k} ${nm}${j + 1}: ${p}`)));
      const tm = walks.flatMap((r) => [...r.turns.map((t) => t.m), r.goal]);
      if (new Set(tm).size !== tm.length) bad.push(`${k} ${nm}: 同じ日のほかの道と、曲がる角・目的地の目印が重なる`);
      const rc = L[L.length - 1], want = walks[0].turns.map((t) => t.m);
      if (JSON.stringify(rc.items) !== JSON.stringify(want) || !want.every((id) => rc.shelf.includes(id)) || new Set(rc.shelf).size !== rc.shelf.length || rc.shelf.length !== (want.length <= 3 ? 6 : 9)) bad.push(`${k} ${nm}: 思い出しの選び肢`);
    }
    if (bad.length > 20) break;
  }
  check("今日の3本・上級2本（3年分）：道は地図の中・となりへ1つずつ・同じ交差点を通らない・曲がる回数と右左が合う・目印が角に接する・思い出しの選び肢", bad.length === 0, bad.slice(0, 8).join(" / "));
  const k = dayKey(40);
  check("今日の道・上級は日付から決まり、何度作っても同じ（どの端末でも同じ）", JSON.stringify(M.dailyList(k)) === JSON.stringify(M.dailyList(k)) && JSON.stringify(M.hardList(k)) === JSON.stringify(M.hardList(k)) && JSON.stringify(M.dailyList(k)) !== JSON.stringify(M.dailyList(dayKey(41))));
  // 見た目のくり返しを防ぐ：3年分で、1本目の道の形が同じ日が多すぎない
  const shapes = new Set(); for (let d = 0; d < 365; d++) shapes.add(JSON.stringify(M.dailyList(dayKey(d))[0].path));
  check("1年分の1本目の道は、ほとんどが別の形（300種類以上）", shapes.size >= 300, shapes.size);
  const fb = []; for (let i = 0; i < 4000; i++) { const t = 2 + (i % 9); try { routeProblems(M.freeWalk(t), t).forEach((p) => fb.push(`${t}: ${p}`)); } catch (e) { fb.push(String(e)); } if (fb.length > 10) break; }
  check("練習・とことんの道（曲がる回数2〜10を4000本）も同じ決まりを守る", fb.length === 0, fb.slice(0, 5).join(" / "));
  check("右・左の決め方：東へ進んで南へ曲がると右（画面は下が南）", M.turnWord([1, 0], [0, 1]) === "右" && M.turnWord([0, -1], [-1, 0]) === "左" && M.turnWord([0, 1], [-1, 0]) === "右");
  check("目印の id は重ならず、名前は全部ちがう", new Set(M.IDS).size === M.IDS.length && new Set(M.MARKS.map((m) => m[2])).size === M.MARKS.length);
  check("覚え方のコツは7つ、どれも今日の1本目で例が作れる", M.TIPS.length === 7 && M.TIPS.every((t) => typeof t.ex(M.dailyList(k)[0]) === "string"));
}

// 2. ファイルの決まり（ブラウザを使わない）
const html = readFileSync(path.join(root, "index.html"), "utf8"), genSrc = readFileSync(path.join(root, "gen.js"), "utf8");
{
  const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/(www\.who\.int|doi\.org|pubmed\.ncbi\.nlm\.nih\.gov|pmc\.ncbi\.nlm\.nih\.gov)\//.test(u));
  check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときだけ開く）", ext.length === 0, ext.join(","));
  check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
  check("Math.random は練習・とことんの道と、回の名札だけ（今日・上級は日付の乱数）", (html.match(/Math\.random/g) || []).length === 1 && (genSrc.match(/Math\.random/g) || []).length === 1);
  const bad = (html + genSrc).match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("乱数を sort の比較の中で引かない（ブラウザで引く回数が変わり、同じ日に別の道になる）", bad.length === 0, bad.join(" / "));
  // 言い方：認知症を予防できる・治るとは言わない（おつかいメモと同じ決まり）
  const claim = html.replace(/予防したり治したりするものではありません/g, "");
  check("言い方：「予防できる」「治る」「効果がある」と言い切らない", !/予防(でき|します|になる|に効|効果)|治(る|せる|ります)|効果があ(る|ります)|ボケ防止|脳が若返/.test(claim));
  check("「このゲームについて」に、医療機器でないこと・WHO 指針の弱い推しと出典がある", /医療機器ではなく/.test(html) && /勧めてもよい/.test(html) && /www\.who\.int/.test(html) && /21497950/.test(html));
  check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
  check("実在のお店・会社の名前を使わない", !/セブン|ローソン|ファミマ|ファミリーマート|イオン|スタバ|マクドナルド|郵便局株式会社|みずほ|三菱|三井住友|ゆうちょ|JR/.test(html + genSrc));
  check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8")));
  const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/machi-michijun/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630);
  const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だと GitHub がフォームを出さない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy));
  const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても4秒で保存したものを返す・ふつうはネットの返事", st.ok, JSON.stringify(st)); }
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（gen.js・transfer.js も）、外へ何も送らない", ["./index.html", "./gen.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "町の道順" && mf.icons.length >= 2 && mf.start_url === "./");
  check("引き継ぎ：transfer.js を index.html の head に置き、記録のキーだけを移す（a11y-v1 はゲームどうしで分け合うので入れない）", /<script src="transfer\.js" data-game="machi-michijun" data-keys="michijun-v1,michijun-fs"><\/script>/.test(html) && html.indexOf("transfer.js") < html.indexOf("</head>") && /data-hk/.test(html));
}

// 3. ブラウザで遊ぶ（同じサイトから配る。引き継ぎの QR の URL も確かめるため）
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => { let f = decodeURIComponent(new URL(req.url, "http://x").pathname); if (f.endsWith("/")) f += "index.html"; const p = path.join(root, f); if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); res.end(readFileSync(p)); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
async function newPage(opt = {}) {
  const ctx = await browser.newContext({ viewport: { width: opt.w || 375, height: 760 }, reducedMotion: "reduce" });
  if (opt.time) await ctx.addInitScript(`{ const off = ${Date.parse(opt.time)} - Date.now(); const N = Date.now; Date.now = () => N() + off; }`);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return p;
}
const runOf = (p, m) => p.evaluate((m) => __mm.load().runs[m], m);
const nodeSel = (q) => `#map .nd[data-x="${q[0]}"][data-y="${q[1]}"]`;
// 正しく歩く：曲がる角と目的地だけを順に押す（まっすぐ先は飛ばして押せる）
async function walkRight(p, mode) {
  const run = await runOf(p, mode), r = run.list[run.res.length];
  for (const i of [...r.turns.map((t) => t.i), r.path.length - 1]) { await p.click(nodeSel(r.path[i])); await p.waitForTimeout(30); }
  await p.waitForSelector("#next", { timeout: 4000 });
  return r;
}
async function recallRight(p, mode) {
  const run = await runOf(p, mode), r = run.list[run.res.length];
  for (const id of r.items) await p.click(`#shelf .item[data-id="${id}"]`);
  await p.click("#decide"); await p.click("#next");
}
try {
  // 3-1 今日の道を通しで
  const p = await newPage({ time: "2026-11-05T03:00:00Z" }); // 実行日に関係なく 2026-11-05 として遊ぶ（あとのカレンダーの検査がこの日を当てにする）
  await p.goto(url);
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  await p.keyboard.press("Escape"); await p.waitForTimeout(100); check("遊び方を Esc で閉じられる", await p.locator("#howto[open]").count() === 0);
  await p.reload(); await p.waitForTimeout(200); check("遊び方を Esc で閉じても、開き直したとき出ない", await p.locator("#howto[open]").count() === 0);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); await p.click("#howto-ok"); await p.reload(); await p.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない", await p.locator("#howto[open]").count() === 0);
  { let again = 0; for (let i = 0; i < 10; i++) { await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); await p.keyboard.press("Escape"); await p.reload(); await p.waitForTimeout(200); again += await p.locator("#howto[open]").count(); } check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0); }
  { const c = await browser.newContext(); const r = await c.newPage(); const big = []; // 題が h1{flex:1} で縦に伸び（伸びない形と比べて4pxより高ければ失敗）、iPad の縦で大きなすき間が出た（shared-workflows incidents/2026-11-07-title-stretched.md）
    for (const [w, h] of [[820, 1180], [390, 844], [1280, 800]]) { await r.setViewportSize({ width: w, height: h }); await r.goto(url); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.waitForTimeout(100);
      const v = await r.evaluate(() => { const e = [...document.querySelectorAll(".title")].find((x) => x.offsetParent); if (!e) return null; const h = e.getBoundingClientRect().height; const f = e.style.flex; e.style.flex = "none"; const n = e.getBoundingClientRect().height; e.style.flex = f; return h - n; });
      if (v === null || v > 4) big.push(`${w}x${h}:${v === null ? "題なし" : "+" + Math.round(v) + "px"}`); }
    check("ホームの題は縦長の画面でも縦に伸びない（820×1180・390×844・1280×800）", big.length === 0, big.join(" ")); await c.close(); }
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(200); check("「わかった」を押したその場で「見た」が残る", await p.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
  check("ホーム：題・今日の道のボタン・文字の大きさ3段・見やすさ・引き継ぎ", await p.locator("h1.title").textContent() === "町の道順" && await p.locator("#go-d").count() && await p.locator("[data-fs]").count() === 3 && await p.locator("[data-a11y-open]").count() && await p.locator("[data-hk]").count());
  await p.click("#go-d");
  check("見る画面：道順のことば（○○の角を右）・もう一度見る・覚え方のコツ・目印の輪", await p.locator("#ways li").count() === 3 && /の角を(右|左)/.test(await p.locator("#ways").textContent()) && await p.locator("#again").count() && await p.locator("#tip").count() && await p.locator("#map .blk.ring").count() === 2);
  check("見る画面：道順の線が目的地まで出ている（動きを減らす設定ではすぐ全部）", (await p.getAttribute("#rt", "points")).split(" ").length === (await runOf(p, "d")).list[0].path.length);
  await p.click("#ready");
  check("たどる画面：線とことばが消え、交差点のボタンが出る", (await p.getAttribute("#rt", "points")) === "" && await p.locator("#ways").count() === 0 && await p.locator("#map .nd").count() === 25);
  const r0 = (await runOf(p, "d")).list[0];
  // まっすぐでない角は数えない
  const diag = [r0.path[0][0] === 0 ? 1 : r0.path[0][0] - 1, r0.path[0][1] === 0 ? 1 : r0.path[0][1] - 1];
  await p.click(nodeSel(diag));
  { const dr = await runOf(p, "d"), dm = await p.textContent("#msg");
    check("ななめの角を押しても、まちがいに数えず、押し方を知らせる", (dr.cur?.miss ?? 0) === 0 && /まっすぐ進める角/.test(dm), dm); }
  // 道でない向きへ1つ進む → まちがい
  const p0 = r0.path[0], p1 = r0.path[1];
  const wrongNb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [p0[0] + dx, p0[1] + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < r0.cols && y < r0.rows && !(x === p1[0] && y === p1[1]));
  await p.click(nodeSel(wrongNb));
  let c = (await runOf(p, "d")).cur;
  check("ちがう道を押すと、まちがい1・その場に残る・✕の印と文字で知らせる", c.miss === 1 && c.pos === 0 && await p.locator("#map .nd.ng").count() === 1 && /その道ではありません/.test(await p.textContent("#msg")));
  // 曲がる角を通りすぎる → 行きすぎ
  const t0 = r0.turns[0], a = r0.path[t0.i], dir = [a[0] - r0.path[t0.i - 1][0], a[1] - r0.path[t0.i - 1][1]], over = [a[0] + dir[0], a[1] + dir[1]];
  const firstStraight = r0.path.slice(0, t0.i + 1).every((q) => q[0] === p0[0] || q[1] === p0[1]);
  if (firstStraight && over[0] >= 0 && over[1] >= 0 && over[0] < r0.cols && over[1] < r0.rows) {
    await p.click(nodeSel(over));
    check("曲がる角を通りすぎると「行きすぎ」と知らせ、まちがいに数える", /行きすぎ/.test(await p.textContent("#msg")) && (await runOf(p, "d")).cur.miss === 2);
  }
  // 続きから：1つ目の角まで進んで読み直す
  await p.click(nodeSel(a));
  const posBefore = (await runOf(p, "d")).cur.pos;
  await p.reload(); await p.click("#go-d");
  c = (await runOf(p, "d")).cur;
  check("途中で閉じても、たどった所から続きから（まちがいの数も残る）", c.stage === "walk" && c.pos === posBefore && c.miss >= 1 && await p.locator("#map .nd.here").count() === 1);
  // ヒント2段
  await p.click("#hint");
  check("ヒント1回目：次に止まる角が光る（答えのことばはまだ出さない）", await p.locator("#map .nd.glow").count() === 1 && !/の角を(右|左)/.test(await p.textContent("#hintbox")));
  await p.click("#hint");
  check("ヒント2回目：そこで曲がる向き（目印のことば）も出て、ヒントは2回まで", /の角を(右|左)|です/.test(await p.textContent("#hintbox")) && await p.isDisabled("#hint") && (await runOf(p, "d")).cur.hints === 2);
  // 残りを歩く
  { const run = await runOf(p, "d"), r = run.list[0]; for (const i of [...r.turns.map((t) => t.i), r.path.length - 1]) if (i > run.cur.pos) { await p.click(nodeSel(r.path[i])); await p.waitForTimeout(30); } }
  await p.waitForSelector("#next");
  check("1本目を歩き終えると、★と道のりのことばと道のり（km）が出る", await p.locator(".verdict .stars").count() === 1 && /km/.test(await p.textContent(".verdict")));
  await p.click("#next"); await p.click("#ready"); await walkRight(p, "d");
  check("まちがい・ヒントなしなら「迷わず着きました」と★3", /迷わず/.test(await p.textContent(".verdict .big")) && (await p.getAttribute(".verdict .stars", "aria-label")) === "星3つ");
  await p.click("#next"); await p.click("#ready"); await walkRight(p, "d");
  check("3本目のあとは「思い出しへ」", /思い出し/.test(await p.textContent("#next")));
  await p.click("#next");
  const rc = (await runOf(p, "d")).list[3];
  check("思い出し：1本目の曲がり角の目印を、6つの中から選ぶ", await p.locator("#shelf .item").count() === 6 && rc.items.length === 2);
  // 1つは正しく、1つはまちがえて選ぶ
  const wrongId = rc.shelf.find((x) => !rc.items.includes(x));
  await p.click(`#shelf .item[data-id="${rc.items[0]}"]`); await p.click(`#shelf .item[data-id="${wrongId}"]`);
  await p.click("#decide");
  check("思い出しの答え合わせ：当たりは✓、ちがうのは✕、思い出せなかったのは点線（色だけで分けない）", await p.locator("#shelf .item.got").count() === 1 && await p.locator("#shelf .item.ng").count() === 1 && await p.locator("#shelf .item.miss").count() === 1);
  await p.click("#next");
  const s1 = await p.evaluate(() => __mm.load()), k = await p.evaluate(() => __mm.todayKey());
  check("今日の記録：まちがい・ヒント・思い出しが日付に入り、途中経過は消える", s1.days[k] && s1.days[k].m.length === 3 && s1.days[k].h[0] === 2 && s1.days[k].r[0] === 1 && s1.days[k].r[2] === 1 && !s1.runs.d);
  const share = await p.textContent(".share");
  const names = M.MARKS.map((m) => m[2]);
  check("シェアの文に目印の名前（答え）を出さない・★の印と思い出しの数だけ", /町の道順 第\d+日/.test(share) && /🧠1\/2/.test(share) && !names.some((n) => share.includes(n)), share);
  check("ミスのある日は Ko-fi の1行を出さない", await p.locator(".kofi").count() === 0);
  check("目印帳に、曲がった角と目的地の目印が入る（3本で12か所）", Object.keys(s1.dex).length === 12 && s1.steps > 0 && s1.walks === 3);
  check("結果の画面に「続けて遊ぶ：とことん」と上級のボタン", await p.locator("#go-e").count() && await p.locator("#go-h").count());
  check("結果の画面に「あと少しの実績」を1つ出す", await p.locator("#achnext").count() === 1);
  await p.click("#back");
  check("ホームに今日の結果と上級のボタンが出る", /今日の結果/.test(await p.textContent("#go-d")) && await p.locator("#go-h").count());
  await p.click("#go-d");
  check("今日の道は1日1回（もう一度押すと結果を見る）", await p.locator(".share").count() === 1 && !(await runOf(p, "d")));
  await p.click("#back");

  // 3-2 上級：ことばが出ない・6列×7行・思い出しは9つ
  await p.click("#go-h");
  check("上級：道順のことばを出さず、地図は6列×7行（42の交差点）", await p.locator("#ways").count() === 0 && await p.locator("#map .blk.ring").count() === 0);
  check("上級：覚え方のコツに例（曲がる向きの並び）を出さない", await p.locator("#tip .ex").count() === 0);
  await p.click("#ready");
  check("上級：交差点は42", await p.locator("#map .nd").count() === 42);
  await walkRight(p, "h"); await p.click("#next"); await p.click("#ready"); await walkRight(p, "h"); await p.click("#next");
  check("上級の思い出しは9つの中から5か所", await p.locator("#shelf .item").count() === 9 && (await runOf(p, "h")).list[2].items.length === 5);
  await recallRight(p, "h");
  check("上級を全部迷わず・思い出し満点で初めて終えると、Ko-fi の1行が出る", await p.locator(".kofi").count() === 1);
  const s2 = await p.evaluate(() => __mm.load());
  check("上級は今日と別の記録", s2.hdays[k] && s2.days[k] && s2.hdays[k].r[0] === 5);
  await p.click("#back");

  // 3-3 練習：記録を増やさない
  await p.click("#go-p"); await p.click('[data-n="3"]'); await p.click("#ready"); await walkRight(p, "p"); await p.click("#next");
  const s3 = await p.evaluate(() => __mm.load());
  check("練習は今日の記録を増やさない（目印帳と道のりは増える）", Object.keys(s3.days).length === 1 && s3.walks === 6 && !s3.runs.p);
  await p.click("#back");

  // 3-4 とことん：迷わず歩くと曲がり角が1つふえる。迷うと👟が減り、3つで終わり
  await p.click("#go-e"); await p.click("#ready"); await walkRight(p, "e");
  let e = await runOf(p, "e");
  check("とことん：一度で歩けたら、次は曲がり角が1つふえる", e.len === 3 && e.life === 3 && e.list.length === 2);
  for (let n = 0; n < 3; n++) {
    await p.click("#next"); await p.click("#ready");
    await p.click("#hint");
    await walkRight(p, "e");
  }
  await p.click("#next");
  const s4 = await p.evaluate(() => __mm.load());
  check("とことん：ヒント・まちがいで👟が減り、3回で終わる・自己ベストが残る", !s4.runs.e && s4.ebest === 2, JSON.stringify({ e: !!s4.runs.e, b: s4.ebest }));
  check("とことんの結果の画面に自己ベストと、もう一度のボタン", await p.locator("#ebest").count() && await p.locator("#go-e").count());
  await p.click("#back");

  // 3-5 実績
  await p.click("#go-ach");
  const achN = await p.evaluate(() => __mm.ACH.length);
  check("実績は10〜14個・まだのものは「いま/目標」と進み具合のバー・取れたものは ✓", achN >= 10 && achN <= 14 && await p.locator(".ach .bar").count() > 0 && /✓ 達成/.test(await p.textContent(".alist")));
  await p.click("#back");
  await p.click("#go-dex");
  check("目印帳：通った目印は名前と回数、まだの目印は「？」", await p.locator(".dex div:not(.no)").count() >= 9 && await p.locator(".dex div.no").count() > 0);
  await p.click("#back");
  // 3-6 古いタブ：別のタブで先に進んだら、古い画面からは書き込まない
  const pA = p, pB = await pA.context().newPage();
  await pA.click("#go-p"); await pA.click('[data-n="2"]'); await pA.click("#ready");
  const before = await pA.evaluate(() => __mm.load().runs.p.id);
  const ra = (await runOf(pA, "p")).list[0];
  await pB.goto(url); await pB.click("#go-p"); await pB.click('[data-n="2"]');
  await pA.click(nodeSel(ra.path[ra.turns[0].i]));
  const rb = await runOf(pA, "p");
  check("古いタブ：別のタブで新しい回を始めたら、古い画面の押した角は書き込まない", rb.id !== before && !(rb.cur && rb.cur.pos), JSON.stringify(rb.cur));
  await pB.close();

  // 3-6b 3回続けてまちがえると次の角が光る・別のタブで歩き終えた回を古いタブで戻さない・引き継ぎの数に文字が入っていても画面で動かさない
  {
    const w = await newPage({ time: "2026-11-05T03:00:00Z" });
    await w.goto(url); await w.evaluate(() => localStorage.setItem("michijun-v1", JSON.stringify({ v: 1, tut: true }))); await w.reload(); await w.click("#go-p"); await w.click('[data-n="2"]'); await w.click("#ready");
    const r = (await runOf(w, "p")).list[0], [x0, y0] = r.path[0], [x1, y1] = r.path[1];
    const bad = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x0 + dx, y0 + dy]).find(([x, y]) => x >= 0 && y >= 0 && x < r.cols && y < r.rows && !(x === x1 && y === y1));
    for (let n = 0; n < 3; n++) await w.click(nodeSel(bad));
    const c3 = (await runOf(w, "p")).cur;
    check("3回続けてまちがえると、ヒントなしでも次の角が光る", c3.hints === 0 && c3.miss === 3 && await w.locator("#map .nd.glow").count() === 1, JSON.stringify(c3));
    await w.evaluate(() => { const s = __mm.load(); s.runs.p.cur.stage = "done"; localStorage.setItem(__mm.KEY, JSON.stringify(s)); });
    await w.click(nodeSel(bad));
    check("古いタブ：別のタブで歩き終えた回を、歩く途中に戻さない", (await runOf(w, "p")).cur.stage === "done");
    const m = await w.evaluate(() => { const done = { mode: "d", date: "2026-11-05", id: "x", list: [{}], res: [{ k: "walk", m: 0, h: 0 }], cur: null }; return __mm.merge({ v: 1, t: 2, runs: { d: done } }, { v: 1, t: 1, runs: {} }).runs.d; });
    check("保存に失敗したあと合わせても、終えた回は結果の画面まで残す（初回の判定と Ko-fi の1行を消さない）", m && m.id === "x");
    await w.evaluate(() => localStorage.setItem(__mm.KEY, JSON.stringify({ v: 1, tut: true, ebest: '<img src=x onerror="window.__x=1">', steps: "9<b>", runs: [] })));
    await w.evaluate(() => localStorage.setItem(__mm.KEY, JSON.stringify({ v: 1, tut: true, days: { "2026-11-01": { m: [0], h: [0], r: [1, 1, 0] } }, runs: { d: { mode: "d", date: "2026-11-05", res: [] }, h: "x" } })));
    await w.reload(); await w.waitForTimeout(100);
    check("引き継ぎで入った途中経過の形が合わなくても、ホームが開き、その回だけ外して記録は残す", await w.locator("#go-d").count() === 1 && await w.evaluate(() => { const s = __mm.load(); return !s.runs.d && !s.runs.h && !!s.days["2026-11-01"]; }));
    await w.reload(); await w.waitForTimeout(100);
    check("引き継ぎで入った記録の数に文字が入っていても、画面で動かさない（数にそろえる）", await w.evaluate(() => window.__x === undefined && !document.querySelector("img[src=x]") && __mm.load().ebest === 0 && typeof __mm.load().runs === "object" && !Array.isArray(__mm.load().runs)));
    await w.context().close();
  }

  // 3-7 カレンダーとあとから（1週間あと）
  const q = await newPage({ time: "2026-11-12T03:00:00Z" });
  await q.goto(url); await q.evaluate((s) => localStorage.setItem("michijun-v1", s), JSON.stringify(s1));
  await q.reload(); await q.click("#go-cal");
  check("カレンダー：遊んだ日は★、取りこぼした日（過去7日）は▶", await q.locator('.cal .c[data-k="2026-11-05"] i').textContent() !== "" && await q.locator(".cal .c.miss").count() === 6);
  check("カレンダー：しばらく休んでいた人に連続の日を出さない（合わせての日数だけ）", !/連続/.test(await q.textContent("h1")));
  await q.click('.cal .c.miss[data-k="2026-11-08"]');
  const ar = await q.evaluate(() => __mm.load().runs["a:2026-11-08"]);
  check("あとから：その日の今日の道と同じ道", JSON.stringify(ar.list) === JSON.stringify(M.dailyList("2026-11-08")));
  await q.click("#ready"); await walkRight(q, "a:2026-11-08"); await q.click("#next"); await q.click("#ready"); await walkRight(q, "a:2026-11-08"); await q.click("#next"); await q.click("#ready"); await walkRight(q, "a:2026-11-08"); await q.click("#next"); await recallRight(q, "a:2026-11-08");
  const s5 = await q.evaluate(() => __mm.load());
  check("あとから遊んだ日は adays に入り、今日の記録・Ko-fi には数えない", s5.adays["2026-11-08"] && !s5.days["2026-11-08"] && await q.locator(".kofi").count() === 0 && await q.locator(".share").count() === 0);
  await q.click("#go-cal");
  check("カレンダー：あとから遊んだ日は ↺", (await q.textContent('.cal .c[data-k="2026-11-08"]')).includes("↺"));
  await q.click("#back");
  check("しばらくぶりの人を「おかえりなさい」で迎える（休んだ日を責めない）", await q.locator("#welcome").count() === 1);
  await q.context().close();

  // 3-8 幅320px：横にはみ出さない・押す所は44px以上・上級の交差点の間も44px以上
  const w = await newPage({ w: 320 });
  await w.goto(url); await w.click("#howto-ok");
  const tooSmall = async () => w.$$eval("button, a", (bs) => bs.filter((b) => b.offsetParent && !b.closest("dialog") && !b.closest(".cal")).map((b) => [b.textContent.trim().slice(0, 12), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().width)]).filter(([, h, wd]) => h < 44 || wd < 44));
  check("幅320px：ホームが横にはみ出さず、押す所は44px以上", (await w.evaluate(() => document.documentElement.scrollWidth)) <= 320 && (await tooSmall()).length === 0, JSON.stringify(await tooSmall()));
  await w.evaluate(() => { const s = __mm.load(); s.tut = true; localStorage.setItem("michijun-v1", JSON.stringify(s)); });
  await w.evaluate(() => __mm.save((s) => { s.runs.p = { mode: "p", date: __mm.todayKey(), list: [MM.freeWalk(7)], res: [], cur: { i: 0, stage: "walk", pos: 0, miss: 0, hints: 0, wrong: 0, sel: [] }, id: "x1", a0: [] }; }));
  await w.evaluate(() => __mm.play("p"));
  const gap = await w.$$eval("#map .nd", (ns) => { const r = ns.map((n) => n.getBoundingClientRect()); return Math.min(r[1].left - r[0].left, Math.min(...r.filter((q) => Math.abs(q.left - r[0].left) < 1).slice(1, 2).map((q) => q.top - r[0].top))); });
  const sz = await w.$eval("#map .nd", (n) => n.getBoundingClientRect().height);
  check("幅320px：6列の地図でも、交差点の間は44px以上・押せる丸は44px", gap >= 44 && sz >= 44 && (await w.evaluate(() => document.documentElement.scrollWidth)) <= 320, `間 ${gap} 丸 ${sz}`);
  await w.click("#back");
  for (const fs of ["3"]) { await w.click(`[data-fs="${fs}"]`); }
  check("文字「とても大きい」でも幅320pxで横にはみ出さない", (await w.evaluate(() => document.documentElement.scrollWidth)) <= 320);
  await w.context().close();

  // 3-9 色だけで分けない：たどった線は点線・まちがいの角は✕・思い出しは✓✕点線（CSS の印）
  check("色だけで分けない：たどった線は点線、まちがいの角は✕、思い出しは✓・✕・点線の枠", /\.wk\{[^}]*stroke-dasharray:3\.2 2/.test(html) && /\.nd\.ng::after\{content:"✕"/.test(html) && /\.item\.got::after\{content:"✓"/.test(html) && /\.item\.miss\{outline:4px dashed/.test(html));
  check("色の見分けを助ける設定で、道の線の色を青と橙に替える", /html\.a11y-cvd\{--route:#a34a00/.test(html));

  // 3-10 引き継ぎ
  await checkTransfer({ browser, url, game: "machi-michijun", sample: { "michijun-v1": JSON.stringify({ ...s1, tut: true }), "michijun-fs": "3" }, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) {
  check("ブラウザで通しで遊ぶ（途中で止まった）", false, e.stack || String(e));
}
check("画面のエラーが出ない", errors.length === 0, errors.slice(0, 5).join(" / "));
// 保存に失敗したら知らせる（2026-11-07 暑さ指数よみで見つけた。黙って記録が消えないように）
{ const ps = await browser.newPage(); await ps.goto(url); await ps.waitForTimeout(200);
  check("保存に失敗したら、保存できるまで知らせ続け、保存できたら消す", await ps.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; save(() => {}); save(() => {}); const one = document.querySelectorAll("#savewarn").length === 1 && document.getElementById("savewarn").textContent.includes("保存できませんでした"); await new Promise((r) => setTimeout(r, 2500)); const stay = !!document.getElementById("savewarn"); Storage.prototype.setItem = orig; save(() => {}); return one && stay && !document.getElementById("savewarn"); }));
  check("保存できない帯は画面のいちばん上に場所を取り（ボタンに重ならない）、読み上げの知らせにも出す", await ps.evaluate(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; save(() => {}); const b = document.getElementById("savewarn"); const top = !!b && document.body.firstElementChild === b && getComputedStyle(b).position === "sticky"; const l = document.getElementById("live"); const live = !l || l.textContent.includes("保存できませんでした"); Storage.prototype.setItem = orig; save(() => {}); return top && live && !document.getElementById("savewarn"); }));
  await ps.close(); }
await browser.close();
server.close();

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report", "report.md"), `# 町の道順 QA\n\n${ng.length ? `❌ ${ng.length} 件` : "✅ 全部通った"}（${results.length} 項目）\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail && !r.ok ? `\n  - ${r.detail}` : ""}`).join("\n")}\n`);
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${!r.ok && r.detail ? `\n   ${r.detail}` : ""}`);
console.log(`\n${results.length - ng.length}/${results.length}`);
process.exit(ng.length ? 1 : 0);
