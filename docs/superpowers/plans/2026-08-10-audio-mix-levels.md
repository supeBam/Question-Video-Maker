# 人声与背景音乐混音调整实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将题目和正确答案人声累计提高 10 dB，并将背景音乐音量降至 0.05 后重新生成完整视频。

**Architecture:** 在现有 `getQuestionVoiceTracks()` 返回值中增加统一的人声音量倍率，让题目和答案组件共享同一配置。背景音乐继续由题库 JSON 驱动，不改动原始 TTS 文件。

**Tech Stack:** TypeScript、React、Remotion、Node.js test runner、Remotion 内置 FFprobe

---

### Task 1: 锁定混音参数

**Files:**
- Modify: `tests/question-voice-tracks.test.mjs`
- Modify: `tests/audio-mix.test.mjs`
- Modify: `src/questionVoiceTracks.ts`
- Modify: `src/components/QuestionVoiceTracks.tsx`
- Modify: `src/data/questions.json`

- [ ] **Step 1: 编写人声音量失败测试**

在 `tests/question-voice-tracks.test.mjs` 中把期望返回值更新为：

```js
assert.deepEqual(getQuestionVoiceTracks("q3"), {
  question: "assets/tts/中国朝代历史-第02期/q3-question.mp3",
  answer: "assets/tts/中国朝代历史-第02期/q3-answer.mp3",
  volume: 10 ** (10 / 20),
});
```

- [ ] **Step 2: 编写背景音乐失败测试**

将 `tests/audio-mix.test.mjs` 的断言改为精确参数：

```js
test("背景音乐音量为老年人听感混音值", () => {
  assert.equal(questions.bgm.volume, 0.05);
});
```

- [ ] **Step 3: 运行测试并确认按预期失败**

Run: `npm test`

Expected: 人声音轨缺少 `volume`，背景音乐实际为 `0.08`，两项测试失败。

- [ ] **Step 4: 实现 10 dB 人声倍率**

在 `src/questionVoiceTracks.ts` 中加入并返回统一音量：

```ts
export const VOICE_GAIN_DB = 10;
export const VOICE_VOLUME = 10 ** (VOICE_GAIN_DB / 20);

export type QuestionVoiceTracks = {
  question: string;
  answer: string;
  volume: number;
};
```

在返回对象中加入：

```ts
volume: VOICE_VOLUME,
```

在 `src/components/QuestionVoiceTracks.tsx` 的两条人声音轨上使用相同音量：

```tsx
<Audio src={staticFile(tracks.question)} volume={tracks.volume} />
<Audio src={staticFile(tracks.answer)} volume={tracks.volume} />
```

- [ ] **Step 5: 实现背景音乐音量 0.05**

在 `src/data/questions.json` 中设置：

```json
"volume": 0.05
```

- [ ] **Step 6: 运行完整测试**

Run: `npm test`

Expected: 5 项测试全部通过，0 项失败。

### Task 2: 渲染并验证成品

**Files:**
- Replace: `out/中国朝代历史-第02期-完整配音.mp4`

- [ ] **Step 1: 重新渲染完整视频**

Run: `$env:CI='1'; npx remotion render LiteratureQuiz "out/中国朝代历史-第02期-完整配音.mp4" --log=error`

Expected: 命令退出码为 0，并更新目标 MP4 文件。

- [ ] **Step 2: 检查媒体流**

Run: `& "node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe" -v error -show_entries format=duration,size -show_entries stream=index,codec_type,codec_name -of json "out/中国朝代历史-第02期-完整配音.mp4"`

Expected: 成品包含 H.264 视频流和 AAC 音频流，时长约 95 秒。

- [ ] **Step 3: 完成前重新运行测试**

Run: `npm test`

Expected: 5 项测试全部通过，0 项失败。
