import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { getQuestionVoiceTracks } from "../questionVoiceTracks";

export type QuestionVoiceTracksProps = {
  questionId: string;
  answerStartFrame: number;
};

export const QuestionVoiceTracks: React.FC<QuestionVoiceTracksProps> = ({
  questionId,
  answerStartFrame,
}) => {
  const tracks = getQuestionVoiceTracks(questionId);

  return (
    <>
      <Sequence from={0} name="题目语音">
        <Audio src={staticFile(tracks.question)} volume={tracks.volume} />
      </Sequence>
      <Sequence from={answerStartFrame} name="正确答案语音">
        <Audio src={staticFile(tracks.answer)} volume={tracks.volume} />
      </Sequence>
    </>
  );
};
