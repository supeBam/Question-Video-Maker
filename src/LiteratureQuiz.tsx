import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { Background } from "./components/Background";
import { IntroScene } from "./scenes/IntroScene";
import { QuestionScene } from "./scenes/QuestionScene";
import { CrosswordScene } from "./scenes/CrosswordScene";
import { FillScene } from "./scenes/FillScene";
import { OutroScene } from "./scenes/OutroScene";
import { buildTimeline, type QuizData } from "./types";

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
      <Background
        src={data.background?.src ?? "assets/bg-paper.svg"}
        cloudSrc={data.background?.cloudSrc}
        drift={data.background?.drift ?? 0.05}
      />

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
          {slot.kind === "crossword" ? (
            <CrosswordScene slot={slot} total={slots.length} meta={data.meta} voiceOverEnabled={data.voiceOver.enabled} />
          ) : slot.kind === "fill" ? (
            <FillScene slot={slot} total={slots.length} meta={data.meta} voiceOverEnabled={data.voiceOver.enabled} />
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
