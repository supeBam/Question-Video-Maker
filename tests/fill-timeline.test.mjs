import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline, isFill } from "../src/types.ts";

test("填空题走 fill 三段式节奏（呈现 → 思考 → 揭晓）", () => {
  const data = {
    timing: {
      fps: 30,
      introSeconds: 2,
      outroSeconds: 2,
      perQuestion: { presentSeconds: 2, countdownSeconds: 5, revealSeconds: 5.5 },
      fill: { presentSeconds: 4, countdownSeconds: 6, revealSeconds: 7 },
    },
    questions: [
      { type: "fill", id: "f1", stem: "?", answer: "纤凝", explanation: "…" },
    ],
  };
  const t = buildTimeline(data);
  const slot = t.slots[0];

  assert.equal(slot.kind, "fill");
  assert.equal(slot.presentFrames, 120);
  assert.equal(slot.countdownFrames, 180);
  assert.equal(slot.revealFrames, 210);
  assert.equal(slot.durationInFrames, 510);
});

test("填空题缺省 fill 节奏时用兜底值", () => {
  const data = {
    timing: {
      fps: 30,
      introSeconds: 0,
      outroSeconds: 0,
      perQuestion: { presentSeconds: 2, countdownSeconds: 5, revealSeconds: 5.5 },
    },
    questions: [
      { type: "fill", id: "f1", stem: "?", answer: "望舒", explanation: "…" },
    ],
  };
  const t = buildTimeline(data);
  const slot = t.slots[0];

  assert.equal(slot.presentFrames, 105);
  assert.equal(slot.countdownFrames, 180);
  assert.equal(slot.revealFrames, 210);
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
  assert.equal(
    isFill({ type: "crossword", id: "c", clues: [] }),
    false
  );
});
