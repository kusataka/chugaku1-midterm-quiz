import { createRequire } from "node:module";
import Module from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const bundledNodeModules = "C:/Users/kusat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
const bundledPnpmModules = "C:/Users/kusat/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/node_modules";
process.env.NODE_PATH = [bundledNodeModules, bundledPnpmModules, process.env.NODE_PATH].filter(Boolean).join(";");
Module._initPaths();

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = resolve(".");
const outDir = resolve(root, "public/prints");
const datasets = [
  {
    title: "中1中間テスト対策 第1回 基礎確認",
    file: "public/data/mock_exam_5subjects_500questions.json",
    questionsHtml: "chugaku1_midterm_questions.html",
    answersHtml: "chugaku1_midterm_answers.html",
    questionsPdf: "chugaku1_midterm_questions.pdf",
    answersPdf: "chugaku1_midterm_answers.pdf"
  },
  {
    title: "中1中間テスト対策 第2回 高難度",
    file: "public/data/mock_exam_5subjects_500questions_hard.json",
    questionsHtml: "chugaku1_midterm_hard_questions.html",
    answersHtml: "chugaku1_midterm_hard_answers.html",
    questionsPdf: "chugaku1_midterm_hard_questions.pdf",
    answersPdf: "chugaku1_midterm_hard_answers.pdf"
  }
];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: findBrowser(),
  args: ["--no-sandbox"]
});
const page = await browser.newPage();

for (const dataset of datasets) {
  const data = JSON.parse(readFileSync(resolve(root, dataset.file), "utf8"));
  const questionsHtml = buildDocument(`${dataset.title} 問題`, buildQuestionBody(dataset.title, data.questions, false));
  const answersHtml = buildDocument(`${dataset.title} 解答・解説`, buildQuestionBody(dataset.title, data.questions, true));

  writeFileSync(resolve(outDir, dataset.questionsHtml), questionsHtml, "utf8");
  writeFileSync(resolve(outDir, dataset.answersHtml), answersHtml, "utf8");
  await renderPdf(page, questionsHtml, resolve(outDir, dataset.questionsPdf));
  await renderPdf(page, answersHtml, resolve(outDir, dataset.answersPdf));

  console.log(`created public/prints/${dataset.questionsPdf}`);
  console.log(`created public/prints/${dataset.answersPdf}`);
}

await browser.close();

async function renderPdf(page, html, path) {
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" }
  });
}

function findBrowser() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error("PDF生成に使えるChromeまたはEdgeが見つかりません。");
  }
  return found;
}

function buildDocument(title, body) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 portrait; margin: 12mm 10mm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  color: #1f1f1f;
  font-family: "Yu Gothic", "Hiragino Sans", "Meiryo", sans-serif;
  line-height: 1.45;
  font-size: 10.5pt;
}
h1 {
  margin: 0 0 6mm;
  padding-bottom: 3mm;
  border-bottom: 2px solid #222;
  font-size: 18pt;
}
h2 {
  margin: 8mm 0 3mm;
  padding: 2mm 3mm;
  background: #f1f4f8;
  border-left: 5px solid #1457a8;
  font-size: 13pt;
  break-after: avoid;
}
.meta {
  display: flex;
  justify-content: space-between;
  gap: 6mm;
  margin-bottom: 5mm;
  font-size: 10pt;
}
.question {
  break-inside: avoid;
  padding: 3mm 0;
  border-bottom: 1px solid #ddd;
}
.question-head {
  display: flex;
  justify-content: space-between;
  gap: 3mm;
  margin-bottom: 1.5mm;
  font-weight: 700;
}
.tags {
  color: #555;
  font-size: 8.5pt;
  font-weight: 400;
}
.choices {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.4mm 5mm;
  margin: 2mm 0 0;
  padding: 0;
  list-style: none;
}
.choices li {
  min-height: 7mm;
  padding-left: 7mm;
  position: relative;
}
.choices li::before {
  content: attr(data-label);
  position: absolute;
  left: 0;
  top: 0;
  font-weight: 700;
}
.answer {
  margin-top: 2mm;
  padding: 2mm;
  background: #fff8df;
  border: 1px solid #e2c766;
}
.correct {
  font-weight: 700;
  text-decoration: underline;
}
.sheet-space {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4mm;
  margin: 4mm 0 7mm;
}
.box {
  min-height: 9mm;
  border: 1px solid #777;
  padding: 1.5mm;
}
</style>
</head>
<body>
${body}
</body>
</html>`;
}

function buildQuestionBody(title, questions, withAnswers) {
  const grouped = groupBy(questions, (question) => question.subject);
  const subjectOrder = ["数学", "英語", "国語", "理科", "社会"];
  const heading = withAnswers ? `${title} 解答・解説` : `${title} 問題`;
  const meta = withAnswers
    ? "<p>各問題の正解と解説です。解き直しのときは、間違えた理由を一言で書き足してください。</p>"
    : `<div class="sheet-space"><div class="box">名前</div><div class="box">実施日</div><div class="box">点数</div></div>`;

  return `<h1>${heading}</h1>
<div class="meta"><span>5教科500問 / 1問1点</span><span>目標: 450点 / 学年10位以内</span></div>
${meta}
${subjectOrder.map((subject) => buildSubject(subject, grouped[subject] ?? [], withAnswers)).join("")}`;
}

function buildSubject(subject, questions, withAnswers) {
  return `<h2>${escapeHtml(subject)} ${questions.length}問</h2>
${questions.map((question, index) => buildQuestion(question, index + 1, withAnswers)).join("")}`;
}

function buildQuestion(question, number, withAnswers) {
  const labels = ["ア", "イ", "ウ", "エ"];
  return `<section class="question">
  <div class="question-head">
    <span>${number}. ${escapeHtml(question.question)}</span>
    <span class="tags">${escapeHtml(question.unit)} / ${escapeHtml(question.topic)} / ${escapeHtml(question.difficulty)}</span>
  </div>
  <ul class="choices">
    ${question.choices.map((choice, index) =>
      `<li data-label="${labels[index]}" class="${withAnswers && index === question.answer ? "correct" : ""}">${escapeHtml(choice)}</li>`
    ).join("")}
  </ul>
  ${withAnswers ? `<div class="answer"><strong>正解: ${labels[question.answer]} ${escapeHtml(question.choices[question.answer])}</strong><br>${escapeHtml(question.explanation)}</div>` : ""}
</section>`;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
