import assert from "node:assert/strict";
import test from "node:test";
import questions from "../src/data/questions.json" with { type: "json" };

test("背景音乐音量为 0.02", () => {
  assert.equal(questions.bgm.volume, 0.02);
});
