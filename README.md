# 中1中間テスト対策 四択模試

中学1年生向けの5教科四択模試アプリです。スマホで解けるWeb公開版として、GitHub Pagesで配信します。

## 内容

- 公開URL: https://kusataka.github.io/chugaku1-midterm-quiz/
- GitHubリポジトリ: https://github.com/kusataka/chugaku1-midterm-quiz
- 5教科500問: 数学100 / 英語100 / 国語100 / 理科100 / 社会100
- 4択形式
- 回答直後に正誤と解説を表示
- 教科、単元、分野、難易度、技能で絞り込み
- 中断・再開
- 間違えた問題だけ復習
- 得意・苦手分析
- 振り返りシートの印刷
- A4縦型の問題PDF、解答・解説PDF

## データ方針

問題文は添付JSON `mock_exam_5subjects_500questions.json` を読み込み、アプリ側では生成・改変しません。選択肢をシャッフルする場合のみ、正答indexをアプリ側で再計算します。

## ローカル確認

```powershell
npm test
npm run build:pdf
python -m http.server 8000 -d public
```

ブラウザで `http://localhost:8000` を開きます。
