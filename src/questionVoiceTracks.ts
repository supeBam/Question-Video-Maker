import type { QuizData } from "./types";

export type QuestionVoiceTracks = {
  question: string;
  answer: string;
  punchline: string;
  volume: number;
};

const VOICE_VOLUME = 4;

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
