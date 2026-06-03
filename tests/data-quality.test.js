import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const datasets = [
  JSON.parse(readFileSync(new URL("../public/data/mock_exam_5subjects_500questions.json", import.meta.url), "utf8")),
  JSON.parse(readFileSync(new URL("../public/data/mock_exam_5subjects_500questions_hard.json", import.meta.url), "utf8"))
];

test("各模試データは5教科500問である", () => {
  for (const data of datasets) {
    assert.equal(data.questions.length, 500);

    const counts = countBy(data.questions, "subject");
    assert.deepEqual(counts, {
      "社会": 100,
      "数学": 100,
      "英語": 100,
      "国語": 100,
      "理科": 100
    });
  }
});

test("全模試の全問題が4択クイズとして必要なフィールドを持つ", () => {
  for (const data of datasets) {
    const ids = new Set();

    for (const question of data.questions) {
      for (const key of ["id", "subject", "unit", "topic", "difficulty", "targetSkill", "question", "choices", "answer", "explanation"]) {
        assert.notEqual(question[key], undefined, `${question.id ?? "unknown"} lacks ${key}`);
      }

      assert.equal(question.choices.length, 4, `${question.id} choices`);
      assert.ok(Number.isInteger(question.answer), `${question.id} answer is integer`);
      assert.ok(question.answer >= 0 && question.answer <= 3, `${question.id} answer range`);
      assert.equal(ids.has(question.id), false, `${question.id} duplicated`);
      ids.add(question.id);
    }
  }
});

test("高難度版は問題文の完全一致重複がない", () => {
  const hard = datasets[1];
  const duplicates = Object.entries(countBy(hard.questions, "question")).filter(([, count]) => count > 1);

  assert.deepEqual(duplicates, []);
});

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}
