import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { LiteratureQuiz } from "./LiteratureQuiz";
import { buildTimeline, type QuizData } from "./types";
import { THEME } from "./theme";
import quizData from "./data/questions.json";
import crosswordData from "./data/questions-crossword-demo.json";
import wanwuData from "./data/questions-wanwu-yacheng.json";

const data = quizData as QuizData;
const crossData = crosswordData as QuizData;
const wanwu = wanwuData as QuizData;

/**
 * 根据渲染时传入的 props.data 动态重算时长与帧率。
 * 让 render 脚本能通过 `--props`（指向一个含 data 的 JSON 文件）渲染任意题库文件，
 * 而不再把合成时长写死成默认导入的 questions.json。
 */
const calcTimeline: CalculateMetadataFunction<{ data: QuizData }> = ({
  props,
}) => {
  const timeline = buildTimeline(props.data);
  return {
    durationInFrames: timeline.totalFrames,
    fps: timeline.fps,
    props,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LiteratureQuiz"
        component={LiteratureQuiz}
        durationInFrames={buildTimeline(data).totalFrames}
        fps={buildTimeline(data).fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data }}
        calculateMetadata={calcTimeline}
      />
      <Composition
        id="CrosswordQuiz"
        component={LiteratureQuiz}
        durationInFrames={buildTimeline(crossData).totalFrames}
        fps={buildTimeline(crossData).fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: crossData }}
        calculateMetadata={calcTimeline}
      />
      <Composition
        id="WanwuYacheng"
        component={LiteratureQuiz}
        durationInFrames={buildTimeline(wanwu).totalFrames}
        fps={buildTimeline(wanwu).fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: wanwu }}
        calculateMetadata={calcTimeline}
      />
    </>
  );
};
