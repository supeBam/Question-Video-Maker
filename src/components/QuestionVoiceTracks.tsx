import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { getQuestionVoiceTracks } from "../questionVoiceTracks";
import type { QuizData } from "../types";

export type QuestionVoiceTracksProps = {
  meta: Pick<QuizData["meta"], "series" | "episodeLabel">;
  questionId: string;
  answerStartFrame: number;
  /** 该题是否带「一句真相」口播（有 punchline 才播 punchline 音轨） */
  hasPunchline?: boolean;
};

/** 正确答案语音后，隔多久开始播「一句真相」语音（答案语音通常只念一个字母，约 1 秒） */
const ANSWER_TO_PUNCHLINE_SECONDS = 1.2;

export const QuestionVoiceTracks: React.FC<QuestionVoiceTracksProps> = ({
  meta,
  questionId,
  answerStartFrame,
  hasPunchline = false,
}) => {
  const tracks = getQuestionVoiceTracks(meta, questionId);
  const { fps } = useVideoConfig();
  const punchlineStartFrame =
    answerStartFrame + Math.round(ANSWER_TO_PUNCHLINE_SECONDS * fps);

  return (
    <>
      <Sequence from={0} name="题目语音">
        <Audio src={staticFile(tracks.question)} volume={tracks.volume} />
      </Sequence>
      <Sequence from={answerStartFrame} name="正确答案语音">
        <Audio src={staticFile(tracks.answer)} volume={tracks.volume} />
      </Sequence>
      {hasPunchline ? (
        <Sequence from={punchlineStartFrame} name="一句真相语音">
          <Audio src={staticFile(tracks.punchline)} volume={tracks.volume} />
        </Sequence>
      ) : null}
    </>
  );
};
