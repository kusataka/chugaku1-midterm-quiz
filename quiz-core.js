const FILTER_KEYS = ["subject", "unit", "topic", "difficulty", "targetSkill"];

export function filterQuestions(questions, filters = {}) {
  return questions.filter((question) =>
    FILTER_KEYS.every((key) => !filters[key] || filters[key] === "all" || question[key] === filters[key])
  );
}

export function shuffleArray(items, random = Math.random) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function shuffleChoices(question, random = Math.random) {
  const choices = question.choices.map((text, index) => ({
    text,
    originalIndex: index
  }));
  const shuffled = shuffleArray(choices, random);

  return {
    ...question,
    choices: shuffled.map((choice) => choice.text),
    answer: shuffled.findIndex((choice) => choice.originalIndex === question.answer),
    originalAnswer: question.answer
  };
}

export function buildAnswerLog(question, selectedAnswer, now = new Date()) {
  return {
    questionId: question.id,
    subject: question.subject,
    unit: question.unit,
    topic: question.topic,
    difficulty: question.difficulty,
    targetSkill: question.targetSkill,
    selectedAnswer,
    correctAnswer: question.answer,
    isCorrect: selectedAnswer === question.answer,
    answeredAt: now.toISOString()
  };
}

export function summarizeResults(questions, logs) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answered = logs.filter((log) => questionById.has(log.questionId));

  return {
    overall: buildStats(answered),
    bySubject: groupStats(answered, (log) => log.subject),
    byUnit: groupStats(answered, (log) => `${log.subject} / ${log.unit}`),
    byTopic: groupStats(answered, (log) => `${log.subject} / ${log.unit} / ${log.topic}`),
    byDifficulty: groupStats(answered, (log) => log.difficulty),
    byTargetSkill: groupStats(answered, (log) => log.targetSkill)
  };
}

export function rankWeaknesses(summary) {
  return Object.entries(summary.byTopic)
    .map(([key, value]) => ({ key, ...value }))
    .filter((item) => item.total > 0 && item.accuracy < 80)
    .sort((a, b) => a.accuracy - b.accuracy || b.wrong - a.wrong || a.key.localeCompare(b.key, "ja"));
}

export function getWrongQuestions(questions, logs) {
  const wrongIds = new Set(logs.filter((log) => !log.isCorrect).map((log) => log.questionId));
  return questions.filter((question) => wrongIds.has(question.id));
}

export function convertToScore(correct, total, maxScore = 500) {
  if (!total) return 0;
  return Math.round((correct / total) * maxScore);
}

export function getStudyAdvice(summary) {
  const topicWeaknesses = Object.entries(summary.byTopic)
    .map(([key, value]) => ({ key, ...value }))
    .filter((item) => item.accuracy < 60);
  const unitWeaknesses = Object.entries(summary.byUnit)
    .map(([key, value]) => ({ key, ...value }))
    .filter((item) => item.accuracy < 70);
  const skillWeaknesses = Object.entries(summary.byTargetSkill)
    .map(([key, value]) => ({ key, ...value }))
    .filter((item) => item.accuracy < 80);

  return { topicWeaknesses, unitWeaknesses, skillWeaknesses };
}

function groupStats(logs, keyFn) {
  const groups = {};
  for (const log of logs) {
    const key = keyFn(log);
    groups[key] ??= [];
    groups[key].push(log);
  }

  return Object.fromEntries(Object.entries(groups).map(([key, groupLogs]) => [key, buildStats(groupLogs)]));
}

function buildStats(logs) {
  const total = logs.length;
  const correct = logs.filter((log) => log.isCorrect).length;
  const wrong = total - correct;
  const accuracy = total ? Math.round((correct / total) * 100) : 0;

  return {
    total,
    correct,
    wrong,
    accuracy,
    label: judgeAccuracy(accuracy)
  };
}

function judgeAccuracy(accuracy) {
  if (accuracy >= 90) return "得意";
  if (accuracy >= 80) return "概ねOK";
  if (accuracy >= 60) return "要復習";
  return "苦手";
}
