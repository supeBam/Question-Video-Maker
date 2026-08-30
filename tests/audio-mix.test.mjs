import assert from "node:assert/strict";
import test from "node:test";
import questions from "../src/data/questions.json" with { type: "json" };

// 音量是创作调优参数（历史上 0.02 → 0.22 → 0.3），不应锁死具体值，
// 只校验落在合法范围（0 < volume ≤ 1）内。
test("背景音乐音量在合法范围", () => {
  assert.ok(questions.bgm.volume > 0 && questions.bgm.volume <= 1);
});
