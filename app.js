import {
  buildAnswerLog,
  filterQuestions,
  getStudyAdvice,
  getWrongQuestions,
  rankWeaknesses,
  scoreAttempt,
  shuffleArray,
  shuffleChoices,
  summarizeResults
} from "./quiz-core.js";

const EXAMS = {
  basic: {
    id: "basic",
    title: "第1回 基礎確認",
    url: "./data/mock_exam_5subjects_500questions.json",
    thresholds: [
      { min: 90, label: "得意" },
      { min: 80, label: "概ねOK" },
      { min: 60, label: "要復習" },
      { min: 0, label: "苦手" }
    ]
  },
  hard: {
    id: "hard",
    title: "第2回 高難度",
    url: "./data/mock_exam_5subjects_500questions_hard.json",
    thresholds: [
      { min: 90, label: "非常に得意" },
      { min: 75, label: "得意" },
      { min: 60, label: "標準" },
      { min: 40, label: "要復習" },
      { min: 0, label: "苦手" }
    ]
  }
};

const STORAGE_KEY = "chugaku1-midterm-session";
const HISTORY_KEY = "chugaku1-midterm-history-v2";
const OLD_HISTORY_KEY = "chugaku1-midterm-history";
const TARGET_SCORE = 450;

let datasets = {};
let allQuestions = [];
let currentExam = EXAMS.basic;
let session = null;
let latestSummary = null;
let latestScore = null;

const views = {
  setup: document.querySelector("#setupView"),
  quiz: document.querySelector("#quizView"),
  result: document.querySelector("#resultView")
};

const examSelect = document.querySelector("#examSelect");
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
document.querySelector("#finishButton").addEventListener("click", () => showResults({ saveHistory: true }));
document.querySelector("#backToSetupButton").addEventListener("click", () => showView("setup"));
document.querySelector("#newQuizButton").addEventListener("click", resetToSetup);
document.querySelector("#retryWrongButton").addEventListener("click", retryWrongQuestions);
document.querySelector("#printReflectionButton").addEventListener("click", printReflectionSheet);
document.querySelector("#clearHistoryButton").addEventListener("click", clearHistory);
examSelect.addEventListener("change", switchExam);

for (const field of Object.values(fields)) {
  field.addEventListener("change", refreshDependentOptions);
}

loadData();

async function loadData() {
  const entries = await Promise.all(
    Object.values(EXAMS).map(async (exam) => {
      const response = await fetch(exam.url);
      const data = await response.json();
      return [exam.id, data.questions.map((question) => ({ ...question, examId: exam.id, examTitle: exam.title }))];
    })
  );

  datasets = Object.fromEntries(entries);
  switchExam();
  updateResumeButton();
  renderHistoryLists();
}

function switchExam() {
  currentExam = EXAMS[examSelect.value] ?? EXAMS.basic;
  allQuestions = datasets[currentExam.id] ?? [];
  document.querySelector("#dataStatus").textContent = `${currentExam.title}: 5教科 ${allQuestions.length}問を読み込みました。`;
  populateFilters();
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
    examId: currentExam.id,
    examTitle: currentExam.title,
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
  if (!session) return;
  currentExam = EXAMS[session.examId] ?? EXAMS.basic;
  examSelect.value = currentExam.id;
  allQuestions = datasets[currentExam.id] ?? allQuestions;
  showQuestion();
}

function showQuestion() {
  showView("quiz");
  const question = session.questions[session.currentIndex];
  const total = session.questions.length;
  const index = session.currentIndex + 1;
  const percent = Math.round((session.currentIndex / total) * 100);

  document.querySelector("#progressText").textContent = `${index} / ${total}`;
  document.querySelector("#currentSubject").textContent = `${session.examTitle} / ${question.subject}`;
  document.querySelector("#progressBar").style.width = `${percent}%`;
  document.querySelector("#questionTags").innerHTML = [session.examTitle, question.subject, question.unit, question.topic, question.difficulty, question.targetSkill]
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
  const log = {
    ...buildAnswerLog(question, selectedAnswer, new Date()),
    examId: session.examId,
    examTitle: session.examTitle
  };
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
    showResults({ saveHistory: true });
    return;
  }

  session.currentIndex += 1;
  session.answeredCurrent = false;
  saveSession();
  showQuestion();
}

function showResults({ saveHistory = false, attempt = null } = {}) {
  if (attempt) {
    session = attempt.session;
    latestSummary = attempt.summary;
    latestScore = attempt.score;
    renderResult(attempt);
    showView("result");
    return;
  }

  if (!session || session.logs.length === 0) return;
  latestSummary = summarizeResults(session.questions, session.logs, { thresholds: getExam(session.examId).thresholds });
  latestScore = scoreAttempt(latestSummary.overall, 500, TARGET_SCORE);
  const resultAttempt = {
    id: crypto.randomUUID(),
    examId: session.examId,
    examTitle: session.examTitle,
    startedAt: session.startedAt,
    finishedAt: new Date().toISOString(),
    session: structuredClone(session),
    summary: latestSummary,
    score: latestScore
  };

  if (saveHistory) {
    saveAttemptHistory(resultAttempt);
    localStorage.removeItem(STORAGE_KEY);
    updateResumeButton();
  }

  renderResult(resultAttempt);
  renderHistoryLists();
  showView("result");
}

function renderResult(attempt) {
  const wrongQuestions = getWrongQuestions(session.questions, session.logs);
  const weaknesses = rankWeaknesses(latestSummary);
  const diff = latestScore.diffFromTarget;

  document.querySelector("#convertedScore").textContent = latestScore.rawScore;
  document.querySelector("#resultTitle").textContent = `${attempt.examTitle}：${latestSummary.overall.label}`;
  document.querySelector("#resultSummary").textContent =
    `${latestScore.rawScore}点 / ${latestScore.maxRawScore}点（1問1点） 正答率${latestSummary.overall.accuracy}% 500点換算${latestScore.convertedScore}点 目標との差${diff >= 0 ? "+" : ""}${diff}点`;
  document.querySelector("#subjectResults").innerHTML = renderStats(latestSummary.bySubject);
  document.querySelector("#skillResults").innerHTML = renderStats(latestSummary.byTargetSkill);
  document.querySelector("#weaknessResults").innerHTML = weaknesses.slice(0, 10).map(renderWeakness).join("") || "<p>大きな苦手分野はありません。</p>";
  document.querySelector("#wrongResults").innerHTML = wrongQuestions.slice(0, 30).map(renderWrongQuestion).join("") || "<p>間違えた問題はありません。</p>";
  document.querySelector("#retryWrongButton").disabled = wrongQuestions.length === 0;
  renderHistoryLists();
}

function retryWrongQuestions() {
  const wrongQuestions = getWrongQuestions(session.questions, session.logs);
  if (!wrongQuestions.length) return;
  const exam = getExam(session.examId);
  session = {
    examId: exam.id,
    examTitle: exam.title,
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
  if (!session || !latestSummary || !latestScore) return;

  const studentName = document.querySelector("#studentName").value || "＿＿＿＿＿＿";
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
  <p>模試：${escapeHtml(session.examTitle)}　生徒名：${escapeHtml(studentName)}　実施日：${date}　目標：5教科450点・10位以内</p>
  <h2>1. 総合結果</h2>
  <table><tr><th>得点</th><th>総問題数</th><th>正答率</th><th>500点換算</th><th>目標との差</th></tr>
  <tr><td>${latestScore.rawScore}点 / ${latestScore.maxRawScore}点</td><td>${latestSummary.overall.total}</td><td>${latestSummary.overall.accuracy}%</td><td>${latestScore.convertedScore}</td><td>${latestScore.diffFromTarget}</td></tr></table>
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
        <div class="metric">${value.correct}点 / ${value.total}点 (${value.accuracy}%)</div>
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

function renderHistoryLists() {
  const history = readHistory();
  const html = history.length ? history.map(renderHistoryItem).join("") : "<p>まだ保存された履歴はありません。</p>";
  document.querySelector("#historyList").innerHTML = html;
  document.querySelector("#resultHistoryList").innerHTML = html;
  document.querySelectorAll("[data-history-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const attempt = readHistory()[Number(button.dataset.historyIndex)];
      if (attempt) showResults({ attempt });
    });
  });
}

function renderHistoryItem(attempt, index) {
  const date = new Date(attempt.finishedAt).toLocaleString("ja-JP");
  return `
    <div class="history-item">
      <div>
        <strong>${escapeHtml(attempt.examTitle)} ${attempt.score.rawScore}点/${attempt.score.maxRawScore}点</strong>
        <div class="history-meta">${date} / 正答率${attempt.summary.overall.accuracy}% / 500点換算${attempt.score.convertedScore}点</div>
      </div>
      <button class="secondary-button" type="button" data-history-index="${index}">見直す</button>
    </div>
  `;
}

function tableFromStats(stats, title) {
  return `<table><tr><th>${title}</th><th>得点</th><th>満点</th><th>正答率</th><th>判定</th></tr>${
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

function saveAttemptHistory(attempt) {
  const history = readHistory().filter((item) => item.id !== attempt.id);
  history.unshift(attempt);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
}

function readHistory() {
  const current = localStorage.getItem(HISTORY_KEY);
  if (current) return JSON.parse(current);

  const old = localStorage.getItem(OLD_HISTORY_KEY);
  if (!old) return [];

  try {
    const parsed = JSON.parse(old);
    if (!parsed.session || !parsed.summary) return [];
    const score = scoreAttempt(parsed.summary.overall, 500, TARGET_SCORE);
    return [{
      id: "legacy-latest",
      examId: parsed.session.examId ?? "basic",
      examTitle: parsed.session.examTitle ?? "第1回 基礎確認",
      startedAt: parsed.session.startedAt,
      finishedAt: parsed.finishedAt,
      session: parsed.session,
      summary: parsed.summary,
      score
    }];
  } catch {
    return [];
  }
}

function clearHistory() {
  if (!confirm("過去の解答履歴をすべて削除しますか。")) return;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(OLD_HISTORY_KEY);
  renderHistoryLists();
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
  latestScore = null;
  localStorage.removeItem(STORAGE_KEY);
  updateResumeButton();
  renderHistoryLists();
  showView("setup");
}

function getExam(examId) {
  return EXAMS[examId] ?? EXAMS.basic;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
