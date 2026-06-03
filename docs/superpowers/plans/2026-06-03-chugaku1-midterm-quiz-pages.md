# Chugaku1 Midterm Quiz Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中学1年生向け中間テスト対策として、5教科500問のスマホ対応4択模試アプリを静的HTML/JS/CSSで実装し、GitHub Pagesで無料公開する。

**Architecture:** 現ワークスペースはほぼ空なので、公開用フォルダ `public/` に静的アプリを新規作成する。ZIP内のJSON問題データは改変せず `public/data/mock_exam_5subjects_500questions.json` に配置し、アプリ側で読み込み、回答履歴、分析、振り返りシート、間違い復習を実装する。

**Tech Stack:** HTML / CSS / Vanilla JavaScript / localStorage / Node.js test runner / GitHub CLI / GitHub Pages

---

## Input Summary

- 添付ZIP: `C:\Users\kusat\Downloads\chugaku1_midterm_mock_exam_v1.zip`
- 主要データ: `mock_exam_5subjects_500questions.json`
- 問題数: 500問
- 教科別: 数学100、英語100、国語100、理科100、社会100
- 難易度別: basic 355、standard 145
- 公開要件: パスワードなし、GitHub Pages、静的ファイルのみ、公開後URL 200確認

## File Structure

- Create: `public/index.html`
  - アプリの画面骨格。ホーム、条件選択、クイズ、結果、復習、印刷シートを1ページで表示する。
- Create: `public/styles.css`
  - スマホ優先UI、4択ボタン、正誤表示、結果表、印刷用スタイル。
- Create: `public/app.js`
  - 状態管理、JSON読み込み、出題、回答、再開、結果表示、印刷シート生成。
- Create: `public/quiz-core.js`
  - 純粋関数。シャッフル、正答index再計算、絞り込み、集計、弱点ランキング、復習対象抽出。
- Create: `public/data/mock_exam_5subjects_500questions.json`
  - ZIPからコピーする500問データ。
- Create: `public/data/reflection_sheet_template.html`
  - ZIPからコピーする振り返りシートテンプレート。必要ならアプリ側で差し込みに使う。
- Create: `tests/quiz-core.test.js`
  - コアロジックの自動テスト。
- Create: `tests/data-quality.test.js`
  - 500問データの品質検証。
- Create: `package.json`
  - Node test runner用。公開物には含めない。
- Create: `.gitignore`
  - `node_modules/`、一時ファイル、認証情報を除外。
- Create: `README.md`
  - 公開URL、使い方、データ出典方針、GitHub Pages公開手順。

## Task 1: Static Assets And Data

- [ ] ZIPから `mock_exam_5subjects_500questions.json` と `reflection_sheet_template.html` を `public/data/` にコピーする。
- [ ] `package.json` を作成し、`npm test` で `node --test tests/*.test.js` が動くようにする。
- [ ] `.gitignore` を作成し、認証情報・依存フォルダ・一時ファイルを除外する。
- [ ] `README.md` に「問題文は添付JSONを読み込み、アプリ側では生成・改変しない」と明記する。

## Task 2: Data Quality Tests

- [ ] `tests/data-quality.test.js` を作成する。
- [ ] 500問であること、5教科各100問であることを検証する。
- [ ] 各問題に `id, subject, unit, topic, difficulty, targetSkill, question, choices, answer, explanation` があることを検証する。
- [ ] `choices` が4件、`answer` が0から3、ID重複なしを検証する。
- [ ] `npm test` を実行し、データ品質テストを通す。

## Task 3: Core Quiz Logic

- [ ] `tests/quiz-core.test.js` に、絞り込み、シャッフル、正答index再計算、回答ログ生成、集計、弱点ランキング、間違い復習抽出のテストを先に書く。
- [ ] `public/quiz-core.js` に純粋関数を実装する。
- [ ] `filterQuestions(questions, filters)` は subject/unit/topic/difficulty/targetSkill を任意条件で絞り込む。
- [ ] `shuffleChoices(question)` は選択肢順を変えた場合も正答indexを再計算する。
- [ ] `buildAnswerLog(question, selectedAnswer, now)` は指定ログ形式を返す。
- [ ] `summarizeResults(questions, logs)` は総合、教科別、unit別、topic別、targetSkill別の正答率を返す。
- [ ] `rankWeaknesses(summary)` は正答率が低い順、同率なら誤答数が多い順で返す。
- [ ] `getWrongQuestions(questions, logs)` は間違えた問題だけを復習対象として返す。
- [ ] `npm test` を実行して全テストを通す。

## Task 4: App UI

- [ ] `public/index.html` を作成し、スマホで最初に「教科」「単元」「難易度」「出題数」「全教科ミックス」「間違い復習」を選べる画面にする。
- [ ] `public/styles.css` を作成し、44px以上の押しやすい選択肢ボタン、読みやすい文字サイズ、正解/不正解の色分けを実装する。
- [ ] `public/app.js` でJSONを読み込み、フィルタ選択肢を問題データから自動生成する。
- [ ] クイズ画面では1問ずつ表示し、回答直後に○/×、正解、解説、次へボタンを表示する。
- [ ] 選択肢をシャッフルする場合は `shuffleChoices` を使い、正答indexのズレを防ぐ。

## Task 5: Save, Resume, And Review

- [ ] localStorageに現在のセッション、回答履歴、未完了状態を保存する。
- [ ] ページ再読み込み後に「中断した模試を再開」できるようにする。
- [ ] 完了後は結果画面に総問題数、正答数、正答率、500点換算、5教科換算、450点との差を表示する。
- [ ] 教科別、unit別、topic別、targetSkill別スコアを表示する。
- [ ] 苦手分野ランキング、間違えた問題一覧、次に復習すべき内容を表示する。
- [ ] 「間違えた問題だけ復習」ボタンで誤答問題のみの新セッションを開始できるようにする。

## Task 6: Reflection Sheet

- [ ] 結果画面に生徒名入力欄を追加する。
- [ ] `reflection_sheet_template.html` 相当の印刷用HTMLをアプリ内で生成する。
- [ ] 振り返りシートに総合結果、教科別結果、単元別結果、苦手ランキング、間違えた問題一覧、復習優先順位、保護者コメント欄、次回学習日メモ欄を入れる。
- [ ] 「振り返りシートを印刷」ボタンで別ウィンドウ表示または印刷モードに切り替える。
- [ ] PDFはブラウザの印刷機能に任せ、アプリ側は印刷用HTMLを第一優先にする。

## Task 7: Manual Browser Verification

- [ ] ローカルでは静的ファイル確認用に一時サーバーだけ使う。公開物に `server.py` は含めない。
- [ ] `python -m http.server 8000 -d public` または同等コマンドで確認する。
- [ ] スマホ幅で、フィルタ選択、回答、正誤表示、解説表示、次問遷移を確認する。
- [ ] 500問データが読み込めることを確認する。
- [ ] 回答後の保存、再読み込み、再開を確認する。
- [ ] 結果分析、苦手ランキング、間違い復習、振り返りシート印刷を確認する。

## Task 8: GitHub Pages Publish

- [ ] `gh auth status` でGitHub CLIの認証状態を確認する。
- [ ] 未作成ならGitHubリポジトリを作成する。候補名は `chugaku1-midterm-quiz`。
- [ ] `git add .`、`git commit -m "feat: add chugaku1 midterm quiz app"` を実行する。
- [ ] `git push -u origin master` または現在ブランチ名に合わせてpushする。
- [ ] GitHub Pagesの公開元を `master` ブランチの `/public` に設定する。CLIで可能なら `gh api` を使う。
- [ ] Pages URLを取得し、公開されるまで待機する。
- [ ] `Invoke-WebRequest <Pages URL> -UseBasicParsing` でHTTP 200を確認する。
- [ ] 最終報告に公開URL、GitHubリポジトリURL、問題数、教科別内訳、難易度別内訳、確認内容を載せる。

## Acceptance Criteria

- [ ] GitHub Pages URLがパスワードなしで開ける。
- [ ] 公開URLがHTTP 200を返す。
- [ ] `public/` だけでアプリが動作し、`server.py` などローカルサーバー依存を含まない。
- [ ] 5教科500問を読み込める。
- [ ] 教科別、unit別、topic別、difficulty別、targetSkill別に絞り込める。
- [ ] 4択回答後すぐに正誤と解説が出る。
- [ ] 間違えた問題だけ復習できる。
- [ ] 中断・再開できる。
- [ ] 結果画面に指定分析項目が表示される。
- [ ] 振り返りシートを印刷用HTMLとして出力できる。
- [ ] `npm test` が通る。
