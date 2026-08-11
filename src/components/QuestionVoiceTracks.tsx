import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { getQuestionVoiceTracks } from "../questionVoiceTracks";
import type { QuizData } from "../types";

export type QuestionVoiceTracksProps = {
  meta: Pick<QuizData["meta"], "series" | "episodeLabel">;
  questionId: string;
  answerStartFrame: number;
};

export const QuestionVoiceTracks: React.FC<QuestionVoiceTracksProps> = ({
  meta,
  questionId,
  answerStartFrame,
}) => {
  const tracks = getQuestionVoiceTracks(meta, questionId);

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
