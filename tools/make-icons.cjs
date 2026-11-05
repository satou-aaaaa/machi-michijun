// アプリのアイコン（icon-192.png・icon-512.png）を作る。緑の区画のあいだを、家から旗へ赤い道順の線。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    const blk = [];
    for (const x of [14, 42, 70]) for (const y of [14, 42, 70]) blk.push(`<rect x="${x + 2}" y="${y + 2}" width="20" height="20" rx="4" fill="#dfe9d2" stroke="#b9cca4" stroke-width="1.5"/>`);
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#c9cbc0"/>${blk.join("")}
      <polyline points="12,88 12,40 40,40 40,12 88,12" fill="none" stroke="#c8402b" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="12" cy="88" r="7" fill="#fffdf6" stroke="#232a24" stroke-width="2.5"/>
      <circle cx="88" cy="12" r="7" fill="#c8402b" stroke="#fffdf6" stroke-width="2.5"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
