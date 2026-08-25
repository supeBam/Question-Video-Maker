import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { IntroScene } from "./scenes/IntroScene";
import { QuestionScene } from "./scenes/QuestionScene";
import { CrosswordScene } from "./scenes/CrosswordScene";
import { OutroScene } from "./scenes/OutroScene";
import { buildTimeline, isCrossword, type QuizData } from "./types";

export type LiteratureQuizProps = {
  data: QuizData;
};

/**
 * 主合成：全部时间轴由题库 JSON 推导，
 * 增删题目不需要改这里的任何一行代码。
 */
export const LiteratureQuiz: React.FC<LiteratureQuizProps> = ({ data }) => {
  const timeline = buildTimeline(data);
  const { introFrames, outroFrames, slots, totalFrames } = timeline;

  return (
    <AbsoluteFill>
      {/* 背景放在 Sequence 之外，保证整片连续 */}
      <Background />

      {data.bgm.enabled ? (
        <Audio src={staticFile(data.bgm.file)} volume={data.bgm.volume} loop />
      ) : null}

      <Sequence from={0} durationInFrames={introFrames} name="片头">
        <IntroScene
          intro={data.intro}
          meta={data.meta}
          durationInFrames={introFrames}
        />
      </Sequence>

      {slots.map((slot) => (
        <Sequence
          key={slot.question.id}
          from={slot.from}
          durationInFrames={slot.durationInFrames}
          name={`第${slot.index + 1}题`}
        >
          {isCrossword(slot.question) ? (
            <CrosswordScene slot={slot} total={slots.length} meta={data.meta} voiceOverEnabled={data.voiceOver.enabled} />
          ) : (
            <QuestionScene slot={slot} total={slots.length} meta={data.meta} voiceOverEnabled={data.voiceOver.enabled} />
          )}
        </Sequence>
      ))}

      <Sequence
        from={totalFrames - outroFrames}
        durationInFrames={outroFrames}
        name="片尾"
      >
        <OutroScene
          outro={data.outro}
          meta={data.meta}
          durationInFrames={outroFrames}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
