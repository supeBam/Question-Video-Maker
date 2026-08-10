export type QuestionVoiceTracks = {
  question: string;
  answer: string;
  volume: number;
};

const SERIES_DIRECTORY = "assets/tts/中国朝代历史-第02期";
const VOICE_VOLUME = 4;

export const getQuestionVoiceTracks = (questionId: string): QuestionVoiceTracks => {
  if (!questionId.trim()) {
    throw new Error("题目 ID 不能为空");
  }

  return {
    question: `${SERIES_DIRECTORY}/${questionId}-question.mp3`,
    answer: `${SERIES_DIRECTORY}/${questionId}-answer.mp3`,
    volume: VOICE_VOLUME,
  };
};
