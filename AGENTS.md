# AGENTS.md

町の道順：地図で見た道順を覚えて、同じ道をたどる1日3本の頭の体操（高齢の人向け）。`index.html` と `gen.js`（目印と道の作り方）・`transfer.js`（引き継ぎコード）を GitHub Pages で公開する。

## 準備（最初に一度）

```bash
bash scripts/setup.sh   # Node.js（版は .nvmrc）を確かめ、検査の依存とブラウザを入れる。何度実行してもよい
```

## push する前の確認

```bash
node qa/run.mjs   # 道の作り方（3年分＋練習4000本）・通しで遊ぶ・まちがい・行きすぎ・ヒント・続きから・上級・練習・とことん・思い出し・実績・カレンダー・あとから・古いタブ・言い方・幅320px・PWA・引き継ぎ・見やすさ（CI の QA と同じ）
```

## このリポジトリの決まり

- 言い方：「認知症を予防できる」「治る」「効果がある」と言い切らない（QA が見る）。「頭を使う習慣づくりに」と書き、「このゲームについて」と README に、医療機器でないこと・WHO 2019 指針は頭の訓練を「勧めてもよい」（根拠はとても低い〜低い）・道順の練習の研究は小さいことを出典つきで書く（おつかいメモ satou-aaaaa/otsukai-memo と同じ決まり）。
- 高齢の人向け：文字の大きさ3段（はじめは「大きい」）・押すだけ（なぞる操作なし）・時間制限なし・押す所は44px以上（主なボタンは56〜64px）。道順は何度でも見られる。
- 道は `gen.js` の `makeRoute` が種から作る：交差点の列×行（`sizeFor`。幅320pxでも交差点の間が44px以上になるよう横は6列まで）に、曲がる回数どおりの道を作り、曲がる角・目的地・家には必ずその交差点に接する区画の目印を置く。同じ地図に同じ目印は1つだけ。右・左は歩く向きで決める（画面は下が南。`turnWord`）。
- たどるときは、まっすぐ先の角なら途中を飛ばして押してよい（曲がる角では止まる）。ななめの角はまちがいに数えない。通りすぎは「行きすぎ」と知らせる。3回続けてまちがえたら次の角を光らせる。
- 今日の道（曲がる角2・3・4）・上級（5・6、道のりのことばなし）は日本時間の日付の種（`seedOf`）で決まり、だれでも同じ。`Math.random()` は練習・とことんの道と回の名札だけ（QA が数を見る）。乱数を sort の比較の中で引かない。`gen.js`・`MARKS` を変えると過去の日の道も変わるので、変えた PR に一言書く。`MARKS` は最後に足すだけ（id は目印帳に残る）。
- ★はまちがい＋ヒントの数（0で★3・2まで★2）。ヒントは2段（1回目は次の角を光らせる・2回目は「○○の角を右」）。最後に1本目の曲がり角の目印を思い出す（あとから思い出す練習）。
- 今日の道・上級は1日1回で、途中で閉じてもたどった所から続きから。途中経過はモードごと（`runs.d`・`runs.h`・`runs.p`・`runs.e`・あとからは `runs["a:日付"]`）。書き込む前に、保存した進み具合が画面と同じ回か確かめる（古いタブで二重に入れない）。保存の前に読み直し、まちがい・ヒントの数は多いほうを残す（shared-workflows `incidents/2026-11-04-daily-game-save-gaps.md`）。記録の形を変えたら `fresh()` と `qa/run.mjs` の引き継ぎの見本も合わせる。
- とことん（`runs.e`）：曲がる角2つから、一度で歩けるたびに1つふやす（10まで）。迷った道（まちがい・ヒント）1本で👟1つ、3つで終わり。自己ベスト `ebest`。今日の記録・連続・Ko-fi・シェアには数えない。
- 実績（`ACH`、13個）はいまの記録から毎回数える（新しく残すものは無い）。続けるは合計の日数。取りこぼした日（過去7日・`EPOCH` より後）はカレンダーからあとから遊べ、`adays` に入れて連続・今日の記録・Ko-fi・シェアには数えない。連続の日は1以上のときだけ出す。
- 目印・お店は架空の町のふつうの施設だけ。実在のお店・会社の名前、ほかの作品の名前・キャラは使わない。お笑いの言葉は入れない。
- 共有は遊ぶ人が押したときに開くリンク（X・LINE・Web Share・コピー）だけ。シェアの文に目印の名前・道（答え）を出さない。
- 感想は「感想を送る」から GitHub の Issue フォーム（`.github/ISSUE_TEMPLATE/feedback.yml`、name は「感想フォーム」）を開くだけ。名前・メールは聞かない。
- 応援は Ko-fi（https://ko-fi.com/satouaaaaa）へのただのリンクだけ。今日の道・上級を初めて全部迷わず・思い出し満点で終えたときだけ、結果の画面の下に1行。遊ぶのは無料のまま。
- 外へ通信しない。外から読むのは Google Fonts の文字だけ（CSP の `connect-src 'self'` を広げない）。記録は遊ぶ人のブラウザ（localStorage）だけ。
- 見やすさ：`</head>` の前の見やすさの設定（`<!-- a11y:begin -->`〜`end`）は shared-workflows `template/a11y/a11y.html` の写し、`qa/a11y.mjs` も `template/qa/a11y.mjs` の写しで、ここでは直さない。色だけで分けない（たどった線は点線・まちがいは✕・思い出しは✓✕点線）。
- 引き継ぎ：`transfer.js` と `qa/transfer-check.mjs` は shared-workflows `template/` の写しで、ここでは直さない。`data-keys` は `michijun-v1,michijun-fs,a11y-v1`。
- 機能を足す・直すたびに `qa/run.mjs` に検査を足す。乱数で組む部分は何年分も作って確かめる（shared-workflows `incidents/2026-10-31-roppo-empty-village.md`）。少し遅れて動く処理（setTimeout）は、画面が替わっていたら何もしない（`VIEW`）。
- PWA（`manifest.webmanifest`・`sw.js`・`icon-*.png`）：画面のファイルを足したら `sw.js` の `SHELL` にも足し、中身を大きく変えたら `CACHE` の版を上げる。アイコンは `node tools/make-icons.cjs`、SNS 用の絵 `og.png` は `node tools/make-og.cjs`（今日の道を入れない）。
- 公開リポジトリなので、個人情報・鍵を入れない。

## 公開

- GitHub Pages は `main` のルート（`/`）を公開する。PR の QA と Secret scan が ✅ になると `automerge.yml` が自動でマージする。止めたいときは下書きにするか、ラベル「自動マージしない」を付ける。
- `sw.js`・`manifest.webmanifest` を変える PR は自動ではマージされない（`hold_paths`）。CodeRabbit のレビューを待ち、手でマージする直前に今の head へのレビューを読み直す（shared-workflows `incidents/2026-11-01-roppo-merged-before-review.md`）。CodeRabbit は PR に `@coderabbitai review` とコメントして頼む。

## 共通のきまり

- PR の作り方・マージの仕方は satou-aaaaa/shared-workflows の `routines/pr.md`、全体のきまりは `routines/common.md` に従う。
- CI の部品は shared-workflows の共通部品を呼ぶ。リポジトリ側の .github/workflows には呼び出しと設定値だけを書く。
- Claude 以外の AI・人が作業するときは、shared-workflows の `routines/tool-map.md` と `routines/without-claude.md` を読む。
