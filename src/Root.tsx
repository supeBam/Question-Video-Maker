import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { LiteratureQuiz } from "./LiteratureQuiz";
import { BurstQuiz } from "./BurstQuiz";
import { OutroHookImage } from "./scenes/OutroHookImage";
import { AnswerSheetImage } from "./scenes/AnswerSheetImage";
import { buildTimeline, type QuizData } from "./types";
import { THEME } from "./theme";
import quizData from "./data/questions.json";
import wanwuData from "./data/questions-wanwu-yacheng.json";
import burstDemoData from "./data/questions-burst-demo.json";

const data = quizData as QuizData;
const wanwu = wanwuData as QuizData;
const burstDemo = burstDemoData as QuizData;

/**
 * 根据渲染时传入的 props.data 动态重算时长与帧率。
 * 让 render 脚本能通过 `--props`（指向一个含 data 的 JSON 文件）渲染任意题库文件，
 * 而不再把合成时长写死成默认导入的 questions.json。
 * BurstQuiz 合成强制零片头（对齐合成内组件的处理），保证元数据与画面一致。
 */
const calcTimeline: CalculateMetadataFunction<{ data: QuizData }> = ({
  props,
  compositionId,
}) => {
  const effectiveData: QuizData =
    compositionId === "BurstQuiz"
      ? { ...props.data, timing: { ...props.data.timing, introSeconds: 0 } }
      : props.data;
  const timeline = buildTimeline(effectiveData);
  return {
    durationInFrames: timeline.totalFrames,
    fps: timeline.fps,
    props: { ...props, data: effectiveData },
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
        id="WanwuYacheng"
        component={LiteratureQuiz}
        durationInFrames={buildTimeline(wanwu).totalFrames}
        fps={buildTimeline(wanwu).fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: wanwu }}
        calculateMetadata={calcTimeline}
      />
      <Composition
        id="BurstQuiz"
        component={BurstQuiz}
        durationInFrames={buildTimeline(burstDemo).totalFrames}
        fps={buildTimeline(burstDemo).fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: burstDemo }}
        calculateMetadata={calcTimeline}
      />
      {/* 片尾钩子图：仅用于 still 渲染成 PNG（发布配图/评论区置顶图），不进视频 */}
      <Composition
        id="OutroHook"
        component={OutroHookImage}
        durationInFrames={1}
        fps={30}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: burstDemo }}
      />
      {/* 答案解释图：仅用于 still 渲染成 PNG（视频结尾答案解释，多页自动分张），不进视频 */}
      <Composition
        id="AnswerSheet"
        component={AnswerSheetImage}
        durationInFrames={1}
        fps={30}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: burstDemo, pageIndex: 0 }}
      />
    </>
  );
};
