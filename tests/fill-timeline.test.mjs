import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, isFill } from "../src/types.ts";

test("填空题走 fill 节奏（快闪两段式：呈现 → 揭晓）", () => {
  const data = {
    timing: {
      fps: 30,
      outroSeconds: 3,
      fill: { presentSeconds: 4, countdownSeconds: 0, revealSeconds: 3 },
      ttsWordsPerSecond: 0, // 关闭字数兜底，测纯 timing 字段
    },
    questions: [
      { type: "fill", id: "f1", stem: "?", answer: "纤凝", explanation: "…" },
    ],
  };
  const t = buildTimeline(data);
  const slot = t.slots[0];

  assert.equal(slot.kind, "fill");
  assert.equal(slot.presentFrames, 120); // 4s
  assert.equal(slot.countdownFrames, 0);
  assert.equal(slot.revealFrames, 90); // 3s
  assert.equal(slot.pauseFrames, 30); // 缺省 1s
  assert.equal(slot.durationInFrames, 240); // 120 + 0 + 90 + 30
});

test("填空题缺省 fill 节奏时用快闪兜底", () => {
  const data = {
    timing: { fps: 30, outroSeconds: 3, ttsWordsPerSecond: 0 },
    questions: [
      { type: "fill", id: "f1", stem: "?", answer: "望舒", explanation: "…" },
    ],
  };
  const t = buildTimeline(data);
  const slot = t.slots[0];

  assert.equal(slot.presentFrames, 66); // 2.2s
  assert.equal(slot.countdownFrames, 0);
  assert.equal(slot.revealFrames, 84); // 2.8s
  assert.equal(slot.pauseFrames, 30); // 1s
});

test("isFill 判别填空题与选择题", () => {
  assert.equal(
    isFill({ type: "fill", id: "x", stem: "?", answer: "a", explanation: "b" }),
    true
  );
  assert.equal(
    isFill({ id: "q1", stem: "?", options: [], answerIndex: 0, explanation: "b" }),
    false
  );
});
