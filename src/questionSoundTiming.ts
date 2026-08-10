export type QuestionSoundTimingInput = {
  fps: number;
  presentFrames: number;
  countdownFrames: number;
};

export type QuestionSoundTiming = {
  countdownStartFrame: number;
  countdownDurationInFrames: number;
  answerStartFrame: number;
};

export const getQuestionSoundTiming = ({
  fps,
  presentFrames,
  countdownFrames,
}: QuestionSoundTimingInput): QuestionSoundTiming => {
  const answerStartFrame = presentFrames + countdownFrames;
  const countdownStartFrame = Math.max(
    presentFrames,
    answerStartFrame - Math.round(3 * fps)
  );

  return {
    countdownStartFrame,
    countdownDurationInFrames: answerStartFrame - countdownStartFrame,
    answerStartFrame,
  };
};
