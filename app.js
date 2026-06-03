import {
  buildAnswerLog,
  convertToScore,
  filterQuestions,
  getStudyAdvice,
  getWrongQuestions,
  rankWeaknesses,
  shuffleArray,
  shuffleChoices,
  summarizeResults
} from "./quiz-core.js";

const DATA_URL = "./data/mock_exam_5subjects_500questions.json";
const STORAGE_KEY = "chugaku1-midterm-session";
const HISTORY_KEY = "chugaku1-midterm-history";
const TARGET_SCORE = 450;

let allQuestions = [];
let session = null;
let latestSummary = null;

const views = {
  setup: document.querySelector("#setupView"),
  quiz: document.querySelector("#quizView"),
  result: document.querySelector("#resultView")
};

const fields = {
  subject: document.querySelector("#subjectFilter"),
  unit: document.querySelector("#unitFilter"),
  topic: document.querySelector("#topicFilter"),
  difficulty: document.querySelector("#difficultyFilter"),
  targetSkill: document.querySelector("#targetSkillFilter"),
  limit: document.querySelector("#questionLimit")
};

document.querySelector("#setupForm").addEventListener("submit", startQuiz);
document.querySelector("#resumeButton").addEventListener("click", resumeQuiz);
document.querySelector("#nextButton").addEventListener("click", nextQuestion);
document.querySelector("#finishButton").addEventListener("click", showResults);
document.querySelector("#backToSetupButton").addEventListener("click", () => showView("setup"));
document.querySelector("#newQuizButton").addEventListener("click", resetToSetup);
document.querySelector("#retryWrongButton").addEventListener("click", retryWrongQuestions);
document.querySelector("#printReflectionButton").addEventListener("click", printReflectionSheet);

for (const field of Object.values(fields)) {
  field.addEventListener("change", refreshDependentOptions);
}

loadData();

async function loadData() {
  const response = await fetch(DATA_URL);
  const data = await response.json();
  allQuestions = data.questions;
  document.querySelector("#dataStatus").textContent = `5教科 ${allQuestions.length}問を読み込みました。`;
  populateFilters();
  updateResumeButton();
}

function populateFilters() {
  setOptions(fields.subject, ["all", ...unique(allQuestions.map((q) => q.subject))], "すべて");
  setOptions(fields.unit, ["all", ...unique(allQuestions.map((q) => q.unit))], "すべて");
  setOptions(fields.topic, ["all", ...unique(allQuestions.map((q) => q.topic))], "すべて");
  setOptions(fields.difficulty, ["all", ...unique(allQuestions.map((q) => q.difficulty))], "すべて");
  setOptions(fields.targetSkill, ["all", ...unique(allQuestions.map((q) => q.targetSkill))], "すべて");
}

function refreshDependentOptions() {
  const current = readFilters();
  const scoped = filterQuestions(allQuestions, { subject: current.subject });
  keepValue(fields.unit, ["all", ...unique(scoped.map((q) => q.unit))], "すべて");
  keepValue(fields.topic, ["all", ...unique(scoped.map((q) => q.topic))], "すべて");
  keepValue(fields.difficulty, ["all", ...unique(scoped.map((q) => q.difficulty))], "すべて");
  keepValue(fields.targetSkill, ["all", ...unique(scoped.map((q) => q.targetSkill))], "すべて");
}

function startQuiz(event) {
  event.preventDefault();
  const filters = readFilters();
  let questions = filterQuestions(allQuestions, filters);
  if (document.querySelector("#shuffleQuestions").checked) {
    questions = shuffleArray(questions);
  }
  if (fields.limit.value !== "all") {
    questions = questions.slice(0, Number(fields.limit.value));
  }
  if (document.querySelector("#shuffleChoiceOrder").checked) {
    questions = questions.map((question) => shuffleChoices(question));
  }
  if (!questions.length) {
    document.querySelector("#dataStatus").textContent = "条件に合う問題がありません。条件を広げてください。";
    return;
  }

  session = {
    startedAt: new Date().toISOString(),
    questions,
    currentIndex: 0,
    logs: [],
    answeredCurrent: false
  };
  saveSession();
  showQuestion();
}

function resumeQuiz() {
  session = readSession();
  if (session) showQuestion();
}

function showQuestion() {
  showView("quiz");
  const question = session.questions[session.currentIndex];
  const total = session.questions.length;
  const index = session.currentIndex + 1;
  const percent = Math.round((session.currentIndex / total) * 100);

  document.querySelector("#progressText").textContent = `${index} / ${total}`;
  document.querySelector("#currentSubject").textContent = question.subject;
  document.querySelector("#progressBar").style.width = `${percent}%`;
  document.querySelector("#questionTags").innerHTML = [question.subject, question.unit, question.topic, question.difficulty, question.targetSkill]
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
  document.querySelector("#questionText").textContent = question.question;
  document.querySelector("#feedbackPanel").classList.add("hidden");
  document.querySelector("#nextButton").classList.add("hidden");
  document.querySelector("#finishButton").classList.toggle("hidden", session.logs.length === 0);

  document.querySelector("#choicesList").innerHTML = question.choices
    .map((choice, choiceIndex) => `<button class="choice-button" type="button" data-choice="${choiceIndex}">${escapeHtml(choice)}</button>`)
    .join("");
  document.querySelectorAll(".choice-button").forEach((button) => {
    button.addEventListener("click", () => answerQuestion(Number(button.dataset.choice)));
  });
}

function answerQuestion(selectedAnswer) {
  if (session.answeredCurrent) return;

  const question = session.questions[session.currentIndex];
  const log = buildAnswerLog(question, selectedAnswer, new Date());
  session.logs.push(log);
  session.answeredCurrent = true;
  saveSession();

  document.querySelectorAll(".choice-button").forEach((button) => {
    const choiceIndex = Number(button.dataset.choice);
    button.disabled = true;
    if (choiceIndex === question.answer) button.classList.add("is-correct");
    if (choiceIndex === selectedAnswer && !log.isCorrect) button.classList.add("is-wrong");
  });

  const feedback = document.querySelector("#feedbackPanel");
  feedback.className = `feedback-panel ${log.isCorrect ? "" : "is-wrong"}`;
  feedback.innerHTML = `
    <strong>${log.isCorrect ? "○ 正解" : "× 不正解"}</strong>
    <p>正解: ${escapeHtml(question.choices[question.answer])}</p>
    <p>${escapeHtml(question.explanation)}</p>
  `;
  feedback.classList.remove("hidden");
  document.querySelector("#nextButton").classList.remove("hidden");
  document.querySelector("#finishButton").classList.remove("hidden");
}

function nextQuestion() {
  if (session.currentIndex >= session.questions.length - 1) {
    showResults();
    return;
  }

  session.currentIndex += 1;
  session.answeredCurrent = false;
  saveSession();
  showQuestion();
}

function showResults() {
  if (!session || session.logs.length === 0) return;

  latestSummary = summarizeResults(session.questions, session.logs);
  const score = convertToScore(latestSummary.overall.correct, latestSummary.overall.total, 500);
  const diff = score - TARGET_SCORE;
  const wrongQuestions = getWrongQuestions(session.questions, session.logs);
  const weaknesses = rankWeaknesses(latestSummary);

  document.querySelector("#convertedScore").textContent = score;
  document.querySelector("#resultTitle").textContent = `${latestSummary.overall.label}です`;
  document.querySelector("#resultSummary").textContent =
    `${latestSummary.overall.correct}/${latestSummary.overall.total}問 正解率${latestSummary.overall.accuracy}% 500点換算${score}点 目標との差${diff >= 0 ? "+" : ""}${diff}点`;
  document.querySelector("#subjectResults").innerHTML = renderStats(latestSummary.bySubject);
  document.querySelector("#skillResults").innerHTML = renderStats(latestSummary.byTargetSkill);
  document.querySelector("#weaknessResults").innerHTML = weaknesses.slice(0, 10).map(renderWeakness).join("") || "<p>大きな苦手分野はありません。</p>";
  document.querySelector("#wrongResults").innerHTML = wrongQuestions.slice(0, 30).map(renderWrongQuestion).join("") || "<p>間違えた問題はありません。</p>";
  document.querySelector("#retryWrongButton").disabled = wrongQuestions.length === 0;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ session, summary: latestSummary, finishedAt: new Date().toISOString() }));
  updateResumeButton();
  showView("result");
}

function retryWrongQuestions() {
  const wrongQuestions = getWrongQuestions(session.questions, session.logs);
  if (!wrongQuestions.length) return;
  session = {
    startedAt: new Date().toISOString(),
    questions: wrongQuestions.map((question) => shuffleChoices(question)),
    currentIndex: 0,
    logs: [],
    answeredCurrent: false
  };
  saveSession();
  showQuestion();
}

function printReflectionSheet() {
  if (!session || !latestSummary) return;

  const studentName = document.querySelector("#studentName").value || "＿＿＿＿＿＿";
  const score = convertToScore(latestSummary.overall.correct, latestSummary.overall.total, 500);
  const weaknesses = rankWeaknesses(latestSummary);
  const advice = getStudyAdvice(latestSummary);
  const wrongQuestions = getWrongQuestions(session.questions, session.logs);
  const date = new Date().toLocaleDateString("ja-JP");

  const html = `<!doctype html>
  <html lang="ja"><head><meta charset="utf-8"><title>振り返りシート</title>
  <style>
  body{font-family:"Yu Gothic","Hiragino Sans",sans-serif;line-height:1.6;padding:24px;color:#222}
  h1{font-size:22px;border-bottom:3px solid #222;padding-bottom:8px}
  h2{font-size:17px;border-left:6px solid #222;padding-left:10px;margin-top:24px}
  table{width:100%;border-collapse:collapse;margin:10px 0 18px}th,td{border:1px solid #999;padding:7px;font-size:12px;vertical-align:top}th{background:#f2f2f2}.box{border:1px solid #999;min-height:70px;padding:10px}@media print{body{padding:12mm}}
  </style></head><body>
  <h1>中1中間テスト対策 四択模試 振り返りシート</h1>
  <p>生徒名：${escapeHtml(studentName)}　実施日：${date}　目標：5教科450点・10位以内</p>
  <h2>1. 総合結果</h2>
  <table><tr><th>総問題数</th><th>正答数</th><th>正答率</th><th>500点換算</th><th>目標との差</th></tr>
  <tr><td>${latestSummary.overall.total}</td><td>${latestSummary.overall.correct}</td><td>${latestSummary.overall.accuracy}%</td><td>${score}</td><td>${score - TARGET_SCORE}</td></tr></table>
  <h2>2. 教科別結果</h2>${tableFromStats(latestSummary.bySubject, "教科")}
  <h2>3. 単元別結果</h2>${tableFromStats(latestSummary.byUnit, "単元")}
  <h2>4. 苦手分野ランキング</h2><table><tr><th>順位</th><th>分野</th><th>正答率</th><th>誤答数</th></tr>${weaknesses.slice(0, 10).map((w, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(w.key)}</td><td>${w.accuracy}%</td><td>${w.wrong}</td></tr>`).join("")}</table>
  <h2>5. 間違えた問題一覧</h2><table><tr><th>ID</th><th>教科</th><th>問題</th><th>正解</th></tr>${wrongQuestions.map((q) => `<tr><td>${q.id}</td><td>${q.subject}</td><td>${escapeHtml(q.question)}</td><td>${escapeHtml(q.choices[q.answer])}</td></tr>`).join("")}</table>
  <h2>6. 復習優先順位</h2><div class="box">${renderAdviceText(advice).map(escapeHtml).join("<br>")}</div>
  <h2>7. 保護者コメント</h2><div class="box"></div>
  <h2>8. 次回学習日メモ</h2><div class="box"></div>
  </body></html>`;

  const sheet = window.open("", "_blank");
  sheet.document.write(html);
  sheet.document.close();
  sheet.focus();
  sheet.print();
}

function renderStats(stats) {
  return Object.entries(stats)
    .sort(([a], [b]) => a.localeCompare(b, "ja"))
    .map(([key, value]) => `
      <div class="table-row">
        <div><strong>${escapeHtml(key)}</strong><div class="label">${value.label}</div></div>
        <div class="metric">${value.correct}/${value.total} (${value.accuracy}%)</div>
      </div>
    `)
    .join("");
}

function renderWeakness(item, index) {
  return `
    <div class="rank-item">
      <strong>${index + 1}. ${escapeHtml(item.key)}</strong>
      <span class="label">正答率${item.accuracy}% / 誤答${item.wrong}問 / ${item.label}</span>
    </div>
  `;
}

function renderWrongQuestion(question) {
  return `
    <div class="wrong-item">
      <strong>${escapeHtml(question.subject)} ${escapeHtml(question.topic)}</strong>
      <span>${escapeHtml(question.question)}</span>
      <span class="label">正解: ${escapeHtml(question.choices[question.answer])}</span>
    </div>
  `;
}

function tableFromStats(stats, title) {
  return `<table><tr><th>${title}</th><th>正答数</th><th>問題数</th><th>正答率</th><th>判定</th></tr>${
    Object.entries(stats).map(([key, value]) =>
      `<tr><td>${escapeHtml(key)}</td><td>${value.correct}</td><td>${value.total}</td><td>${value.accuracy}%</td><td>${value.label}</td></tr>`
    ).join("")
  }</table>`;
}

function renderAdviceText(advice) {
  const lines = [];
  for (const item of advice.topicWeaknesses.slice(0, 5)) lines.push(`最優先: ${item.key} を復習`);
  for (const item of advice.unitWeaknesses.slice(0, 5)) lines.push(`次優先: ${item.key} の基本確認`);
  for (const item of advice.skillWeaknesses.slice(0, 5)) lines.push(`技能対策: ${item.key} の練習量を増やす`);
  return lines.length ? lines : ["この調子で、間違えた問題の解き直しを続けましょう。"];
}

function readFilters() {
  return Object.fromEntries(Object.entries(fields).filter(([key]) => key !== "limit").map(([key, field]) => [key, field.value]));
}

function setOptions(select, values, allLabel) {
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}">${value === "all" ? allLabel : escapeHtml(value)}</option>`).join("");
}

function keepValue(select, values, allLabel) {
  const previous = select.value;
  setOptions(select, values, allLabel);
  select.value = values.includes(previous) ? previous : "all";
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "ja"));
}

function showView(name) {
  Object.values(views).forEach((view) => view.classList.remove("is-active"));
  views[name].classList.add("is-active");
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  updateResumeButton();
}

function readSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

function updateResumeButton() {
  const button = document.querySelector("#resumeButton");
  button.classList.toggle("hidden", !readSession());
}

function resetToSetup() {
  session = null;
  latestSummary = null;
  localStorage.removeItem(STORAGE_KEY);
  updateResumeButton();
  showView("setup");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
