// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の道（答え）は入れず、遊び方の見本の地図だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const blk = [];
  const marks = { "0,0": "🌳", "1,0": "🍞", "2,0": "🏫", "0,1": "🏠", "1,1": "📮", "2,1": "🌸", "0,2": "☕", "1,2": "🏦", "2,2": "🏁" };
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) blk.push(`<div style="position:absolute;left:${30 + x * 130}px;top:${30 + y * 130}px;width:100px;height:100px;border-radius:14px;background:#dfe9d2;border:3px solid #c7d8b5;display:grid;place-items:center;font-size:56px">${marks[x + "," + y]}</div>`);
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:80px 70px;background:#eef0e4;color:#232a24;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#8f2d1d;letter-spacing:.1em">だれでも同じ 1日3本の道</div>
    <div style="font-size:112px;font-weight:900;margin-top:14px;letter-spacing:.1em">町の道順</div>
    <div style="font-size:40px;margin-top:18px;line-height:1.5">見た道を、覚えてたどれる？<br>目印の角で 右へ、左へ。</div>
    <div style="font-size:28px;margin-top:26px;color:#4f5a51">大きな文字・押すだけ・時間制限なし</div>
    <div style="position:absolute;right:70px;top:65px;width:440px;height:440px;border-radius:24px;background:#c9cbc0;border:5px solid #b3b5aa">
      ${blk.join("")}
      <svg width="440" height="440" style="position:absolute;inset:0"><polyline points="15,275 145,275 145,145 275,145 275,275 405,275" fill="none" stroke="#c8402b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div></body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
