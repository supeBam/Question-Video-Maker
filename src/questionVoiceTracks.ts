import type { QuizData } from "./types";

export type QuestionVoiceTracks = {
  question: string;
  answer: string;
  punchline: string;
  volume: number;
};

/**
 * 片尾口播钩子的配音轨道：单独成段，路径为
 * `assets/tts/{series}-{episodeLabel}/__outro__-outro.mp3`。
 * 没有合成该段时返回 null（片尾静默；SRT 仍会输出钩子文案供剪映手工配音）。
 */
export type OutroVoiceTrack = {
  hook: string;
  volume: number;
};

/**
 * 人声增益倍数。
 *
 * TTS 原始 mp3 实测约 -22~-23 LUFS，直接挂上去成片只有 -23 LUFS，
 * 比账号历史正常成片（-11~-13 LUFS）低约 12 LU，中老年用户听不清。
 * ×4 ≈ +12 dB，正好补齐到 -11 LUFS 左右，与成语/答题线听感一致。
 *
 * ⚠️ ScrollShow（画卷流）此前硬编码 volume={1} 未走这个常量，
 * 导致该线全部成片偏轻。2026-09-15 起两条线共用此常量，改这里即可。
 */
export const VOICE_VOLUME = 4;

type VoiceTrackMeta = Pick<QuizData["meta"], "series" | "episodeLabel">;

export const getQuestionVoiceTracks = (
  meta: VoiceTrackMeta,
  questionId: string
): QuestionVoiceTracks => {
  const series = meta.series.trim();
  const episodeLabel = meta.episodeLabel.replace(/\s+/g, "");
  const normalizedQuestionId = questionId.trim();

  if (!series) throw new Error("栏目名不能为空");
  if (!episodeLabel) throw new Error("期数不能为空");
  if (!normalizedQuestionId) throw new Error("题目 ID 不能为空");

  const seriesDirectory = `assets/tts/${series}-${episodeLabel}`;
  return {
    question: `${seriesDirectory}/${normalizedQuestionId}-question.mp3`,
    answer: `${seriesDirectory}/${normalizedQuestionId}-answer.mp3`,
    punchline: `${seriesDirectory}/${normalizedQuestionId}-punchline.mp3`,
    volume: VOICE_VOLUME,
  };
};

/**
 * 取片尾口播钩子的配音轨道。约定由 gen-burst-tts.py 合成
 * `__outro__-outro.mp3`（不属于任何 qid 的独立段），
 * 缺该文件时返回 null，调用方按静音渲染。
 */
export const getOutroVoiceTrack = (
  meta: VoiceTrackMeta
): OutroVoiceTrack | null => {
  const series = meta.series.trim();
  const episodeLabel = meta.episodeLabel.replace(/\s+/g, "");
  if (!series || !episodeLabel) return null;

  const seriesDirectory = `assets/tts/${series}-${episodeLabel}`;
  return {
    hook: `${seriesDirectory}/__outro__-outro.mp3`,
    volume: VOICE_VOLUME,
  };
};

/**
 * 取片头钩子的配音轨道（HookIntroScene 的口播）。约定由 gen-burst-tts.py 合成
 * `__intro__-intro.mp3`；缺该文件时返回 null，调用方按静音渲染。
 * 台本来源：题库 `intro.voice`（口语钩子）＞ `intro.title` + `intro.subtitle` 拼句。
 */
export const getIntroVoiceTrack = (
  meta: VoiceTrackMeta
): OutroVoiceTrack | null => {
  const series = meta.series.trim();
  const episodeLabel = meta.episodeLabel.replace(/\s+/g, "");
  if (!series || !episodeLabel) return null;

  const seriesDirectory = `assets/tts/${series}-${episodeLabel}`;
  return {
    hook: `${seriesDirectory}/__intro__-intro.mp3`,
    volume: VOICE_VOLUME,
  };
};