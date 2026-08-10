import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionVoiceTracks } from "../src/questionVoiceTracks.ts";

test("题目音轨路径按题目 ID 分为 question 和 answer 两条", () => {
  assert.deepEqual(getQuestionVoiceTracks("q3"), {
    question: "assets/tts/中国朝代历史-第02期/q3-question.mp3",
    answer: "assets/tts/中国朝代历史-第02期/q3-answer.mp3",
    volume: 4,
  });
});

test("题目音轨路径拒绝空题目 ID", () => {
  assert.throws(() => getQuestionVoiceTracks(""), /题目 ID/);
});
