import assert from "node:assert/strict";
import test from "node:test";
import { buildTimeline } from "../src/types.ts";

/** 最小 burst 题库（10 题选择题）—— 测实测时长兜底 */
const burstData = () => ({
  meta: { series: "成语", episode: 1, episodeLabel: "第 01 期", hostTag: "@x" },
  timing: { fps: 30, introSeconds: 0, outroSeconds: 3, pacing: "burst" },
  intro: { kicker: "", title: "挑战", subtitle: "", hint: "" },
  outro: { headline: "", scoreHints: [], cta: "", ctaSub: "" },
  voiceOver: { enabled: true },
  bgm: { enabled: false, file: "", volume: 0 },
  questions: Array.from({ length: 10 }, (_, i) => ({
    id: `q${i + 1}`,
    stem: `第 ${i + 1} 题题干`,
    options: ["A", "B", "C", "D"],
    answerIndex: 0,
    explanation: "解析",
    punchline: "一句话真相",
  })),
});

test("burst 默认走字数兜底（无 measurements）", () => {
  const t = buildTimeline(burstData());
  // 每题时长应该符合字数估算 + 缓冲
  assert.ok(t.slots[0].durationInFrames > 0, "必须有时长");
  assert.ok(t.totalFrames > 0);
});

test("burst 传 audioMeasurements 后，按实测时长覆盖字数估算", () => {
  const data = burstData();
  // 模拟实测时长：题干 5s、答案 3s、真相 4s → 答案段共 7s
  // 默认 burst 兜底：present+countdown=2.2s, reveal=2.8s, pause=1s
  // 题干实测 5s → 题干段需要 5.5s = 165 帧
  // 默认行为：includePunchlineAudio=false → 视频时长只按 answer 实测兜底
  // 答案实测 3s → 答案段需要 answerNeed=3.6s（不含 pause）
  // burstData 默认 revealSeconds=2.8, pauseSeconds=1 → reveal+pause = 3.8s ≥ answerNeed 3.6s 不调整
  // 所以 revealFrames = 2.8s × 30 = 84，pauseFrames = 1s × 30 = 30，总 114 帧
  const measurements = Object.fromEntries(
    data.questions.map((q) => [
      q.id,
      { question: 5000, answer: 3000, punchline: 4000 },
    ])
  );
  const t = buildTimeline(data, { audioMeasurements: measurements });
  const slot = t.slots[0];

  // 题干段 present+countdown 应该 ≥ 5.5s (165 帧)
  const leadFrames = slot.presentFrames + slot.countdownFrames;
  assert.ok(
    leadFrames >= 165,
    `题干段帧数 ${leadFrames} 应 ≥ 165（实测 5s + 缓冲 0.5s）`
  );
  // 答案+pause 总帧数 ≥ 3.6s × 30 = 108 帧（实测 3s + 缓冲 0.6s）
  const total = slot.revealFrames + slot.pauseFrames;
  assert.ok(
    total >= 108,
    `reveal+pause 总帧数 ${total} 应 ≥ 108（实测答案 3s + 缓冲 0.6s）`
  );
  // 此时 punchline 4s 不应被算进视频时长（reveal 应明显 < 答案+真相 7.6s=228 帧）
  assert.ok(
    slot.revealFrames < 228,
    `revealFrames ${slot.revealFrames} 应 < 228（不应包含 punchline 4s）`
  );
});

test("burst includePunchlineAudio=true 时把 punchline 时长算进答案段", () => {
  const data = burstData();
  const measurements = Object.fromEntries(
    data.questions.map((q) => [
      q.id,
      { question: 5000, answer: 3000, punchline: 4000 },
    ])
  );
  const t = buildTimeline(data, {
    audioMeasurements: measurements,
    includePunchlineAudio: true,
  });
  const slot = t.slots[0];
  // 答案+真相实测 7s → 答案段需要 7.6s = 228 帧；
  // revealSeconds = answerNeed - pauseSeconds = 7.6 - 1 = 6.6s = 198 帧（pause=1s 来自 DEFAULT_BURST_TIMING）
  const tDefault = buildTimeline(data, { audioMeasurements: measurements });
  assert.ok(
    slot.revealFrames > tDefault.slots[0].revealFrames,
    `includePunchlineAudio=true 应让 revealFrames 更长（含 punchline 版 ${slot.revealFrames}, 默认版 ${tDefault.slots[0].revealFrames}）`
  );
  // 7s 实测 + 0.6s 缓冲 - 1s pause = 6.6s = 198 帧
  assert.equal(
    slot.revealFrames,
    198,
    `revealFrames 应 = 198（实测 7s + 缓冲 0.6s - pause 1s = 6.6s）`
  );
});

test("burst 实测时长比兜底短时，保持兜底原值（不缩短）", () => {
  const data = burstData();
  // 实测时长很短（0.5s 题干、0.3s 答案），不应把视频时长压到比 timing 字段还短
  const measurements = Object.fromEntries(
    data.questions.map((q) => [
      q.id,
      { question: 500, answer: 300, punchline: 200 },
    ])
  );
  const tShort = buildTimeline(data, { audioMeasurements: measurements });
  const tDefault = buildTimeline(data);
  const sShort = tShort.slots[0];
  const sDefault = tDefault.slots[0];
  // 实测很短的时长不应该把时长压短
  assert.ok(
    sShort.durationInFrames >= sDefault.durationInFrames,
    `实测过短时不应压缩视频时长（实测版=${sShort.durationInFrames}, 默认版=${sDefault.durationInFrames}）`
  );
});

test("burst 实测时长只覆盖部分段时，未覆盖段保留兜底", () => {
  const data = burstData();
  // 只有 question 实测，answer/punchline 缺省 → 用字数兜底
  const measurements = { q1: { question: 10000 } };
  const t = buildTimeline(data, { audioMeasurements: measurements });
  const slot = t.slots[0];
  // 题干段被实测拉到至少 10.5s
  const leadFrames = slot.presentFrames + slot.countdownFrames;
  assert.ok(
    leadFrames >= 315,
    `题干段帧数 ${leadFrames} 应 ≥ 315（实测 10s + 缓冲 0.5s）`
  );
});

test("hookAudioMs 覆盖 hook 时长", () => {
  const data = burstData();
  data.timing.hookSeconds = 2;  // 默认 2 秒
  const tDefault = buildTimeline(data);
  const tLong = buildTimeline(data, { hookAudioMs: 8000 });  // 实测 8 秒
  assert.ok(
    tLong.hookFrames >= 240,
    `hook 实测 8s 应至少 240 帧，实际 ${tLong.hookFrames}`
  );
  assert.ok(
    tLong.hookFrames >= tDefault.hookFrames,
    "实测 hook 比默认长时，至少不短"
  );
});

test("outroHookMs 覆盖片尾时长（实测钩子比默认长时拉长视频）", () => {
  const data = burstData();
  data.timing.outroSeconds = 3;  // 默认 3 秒
  const tDefault = buildTimeline(data);
  const tLong = buildTimeline(data, { outroHookMs: 8000 });  // 实测 8 秒
  assert.ok(
    tLong.outroFrames >= 300,
    `片尾实测 8s 应至少 300 帧（实测 8s + 2s 缓冲），实际 ${tLong.outroFrames}`
  );
  assert.ok(
    tLong.outroFrames > tDefault.outroFrames,
    `实测比默认长时，片尾应被拉长（默认 ${tDefault.outroFrames}, 实测 ${tLong.outroFrames}）`
  );
});

test("minimalOutro=true 时 outroHookMs 不生效（整段片尾被跳过）", () => {
  const data = burstData();
  data.timing.minimalOutro = true;
  const t = buildTimeline(data, { outroHookMs: 8000 });
  assert.equal(t.outroFrames, 0, "极简片尾应被完全跳过");
});