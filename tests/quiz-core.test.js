import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnswerLog,
  filterQuestions,
  getWrongQuestions,
  rankWeaknesses,
  scoreAttempt,
  shuffleChoices,
  summarizeResults
} from "../public/quiz-core.js";

const sampleQuestions = [
  {
    id: "math-001",
    subject: "数学",
    unit: "正の数・負の数",
    topic: "加法",
    difficulty: "basic",
    targetSkill: "計算",
    question: "1+1はどれか。",
    choices: ["1", "2", "3", "4"],
    answer: 1,
    explanation: "1+1=2。"
  },
  {
    id: "soc-001",
    subject: "社会",
    unit: "世界と日本の地域構成",
    topic: "緯度",
    difficulty: "standard",
    targetSkill: "用語理解",
    question: "赤道は何度か。",
    choices: ["0度", "30度", "60度", "90度"],
    answer: 0,
    explanation: "赤道は緯度0度。"
  },
  {
    id: "soc-002",
    subject: "社会",
    unit: "世界と日本の地域構成",
    topic: "経度",
    difficulty: "basic",
    targetSkill: "資料活用",
    question: "本初子午線の経度はどれか。",
    choices: ["0度", "45度", "90度", "180度"],
    answer: 0,
    explanation: "本初子午線は経度0度。"
  }
];

test("filterQuestionsは任意の条件で問題を絞り込む", () => {
  const result = filterQuestions(sampleQuestions, {
    subject: "社会",
    difficulty: "basic",
    targetSkill: "資料活用"
  });

  assert.deepEqual(result.map((q) => q.id), ["soc-002"]);
});

test("shuffleChoicesは選択肢順変更後も正答indexを再計算する", () => {
  const shuffled = shuffleChoices(sampleQuestions[0], () => 0);

  assert.deepEqual(shuffled.choices, ["2", "3", "4", "1"]);
  assert.equal(shuffled.answer, 0);
  assert.equal(shuffled.originalAnswer, 1);
});

test("buildAnswerLogは指定形式の回答履歴を作る", () => {
  const log = buildAnswerLog(sampleQuestions[0], 0, new Date("2026-06-03T12:00:00.000Z"));

  assert.deepEqual(log, {
    questionId: "math-001",
    subject: "数学",
    unit: "正の数・負の数",
    topic: "加法",
    difficulty: "basic",
    targetSkill: "計算",
    selectedAnswer: 0,
    correctAnswer: 1,
    isCorrect: false,
    answeredAt: "2026-06-03T12:00:00.000Z"
  });
});

test("summarizeResultsは総合と各分類の正答率を集計する", () => {
  const logs = [
    buildAnswerLog(sampleQuestions[0], 1, new Date("2026-06-03T12:00:00.000Z")),
    buildAnswerLog(sampleQuestions[1], 1, new Date("2026-06-03T12:01:00.000Z")),
    buildAnswerLog(sampleQuestions[2], 2, new Date("2026-06-03T12:02:00.000Z"))
  ];

  const summary = summarizeResults(sampleQuestions, logs);

  assert.equal(summary.overall.total, 3);
  assert.equal(summary.overall.correct, 1);
  assert.equal(summary.overall.accuracy, 33);
  assert.equal(summary.bySubject["数学"].accuracy, 100);
  assert.equal(summary.bySubject["社会"].accuracy, 0);
  assert.equal(summary.byTargetSkill["計算"].label, "得意");
  assert.equal(summary.byTargetSkill["用語理解"].label, "苦手");
});

test("rankWeaknessesは低正答率かつ誤答数が多い順に並べる", () => {
  const logs = [
    buildAnswerLog(sampleQuestions[0], 1, new Date()),
    buildAnswerLog(sampleQuestions[1], 1, new Date()),
    buildAnswerLog(sampleQuestions[2], 2, new Date())
  ];
  const summary = summarizeResults(sampleQuestions, logs);

  const weaknesses = rankWeaknesses(summary);

  assert.equal(weaknesses[0].key, "社会 / 世界と日本の地域構成 / 緯度");
  assert.equal(weaknesses[0].accuracy, 0);
});

test("getWrongQuestionsは間違えた問題だけ返す", () => {
  const logs = [
    buildAnswerLog(sampleQuestions[0], 1, new Date()),
    buildAnswerLog(sampleQuestions[1], 1, new Date())
  ];

  assert.deepEqual(getWrongQuestions(sampleQuestions, logs).map((q) => q.id), ["soc-001"]);
});

test("scoreAttemptは1問1点で得点を返し500点換算も併記する", () => {
  const score = scoreAttempt({ correct: 7, total: 10 }, 500);

  assert.deepEqual(score, {
    rawScore: 7,
    maxRawScore: 10,
    convertedScore: 350,
    diffFromTarget: -100
  });
});

test("summarizeResultsは応用編の判定基準を使える", () => {
  const logs = [
    buildAnswerLog(sampleQuestions[0], 1, new Date()),
    buildAnswerLog(sampleQuestions[1], 0, new Date()),
    buildAnswerLog(sampleQuestions[2], 2, new Date())
  ];

  const summary = summarizeResults(sampleQuestions, logs, {
    thresholds: [
      { min: 90, label: "非常に得意" },
      { min: 75, label: "得意" },
      { min: 60, label: "標準" },
      { min: 40, label: "要復習" },
      { min: 0, label: "苦手" }
    ]
  });

  assert.equal(summary.overall.accuracy, 67);
  assert.equal(summary.overall.label, "標準");
});
