import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { getQuestionSoundTiming } from "../questionSoundTiming";

export type QuestionSoundEffectsProps = {
  presentFrames: number;
  countdownFrames: number;
};

export const QuestionSoundEffects: React.FC<QuestionSoundEffectsProps> = ({
  presentFrames,
  countdownFrames,
}) => {
  const { fps } = useVideoConfig();
  const timing = getQuestionSoundTiming({ fps, presentFrames, countdownFrames });

  return (
    <>
      <Sequence
        from={timing.countdownStartFrame}
        durationInFrames={timing.countdownDurationInFrames}
        name="三秒倒计时音效"
      >
        <Audio src={staticFile("assets/audio/开始三秒倒计时.mp3")} />
      </Sequence>
      <Sequence from={timing.answerStartFrame} name="正确答案音效">
        <Audio src={staticFile("assets/audio/出正确答案的音频.mp3")} />
      </Sequence>
    </>
  );
};
