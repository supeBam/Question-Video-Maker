import assert from "node:assert/strict";
import test from "node:test";
import { getQuestionSoundTiming } from "../src/questionSoundTiming.ts";

test("倒计时音效在答案揭晓前 3 秒开始", () => {
  assert.deepEqual(
    getQuestionSoundTiming({ fps: 30, presentFrames: 60, countdownFrames: 150 }),
    {
      countdownStartFrame: 120,
      countdownDurationInFrames: 90,
      answerStartFrame: 210,
    }
  );
});

test("不足 3 秒的倒计时从倒计时起点播放音效", () => {
  assert.deepEqual(
    getQuestionSoundTiming({ fps: 30, presentFrames: 60, countdownFrames: 60 }),
    {
      countdownStartFrame: 60,
      countdownDurationInFrames: 60,
      answerStartFrame: 120,
    }
  );
});
