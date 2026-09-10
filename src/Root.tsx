import React from "react";
import { Composition } from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { BurstQuiz } from "./BurstQuiz";
import {
  buildTimeline,
  type AudioMeasurements,
  type QuizData,
} from "./types";
import { THEME } from "./theme";
import burstDemoData from "./data/questions-burst-demo.json";

const burstDemo = burstDemoData as QuizData;

/**
 * props schema（Remotion 渲染时由 --props 注入）：
 *   - data: 题库 JSON
 *   - audioMeasurements: 每道题实测音频时长（毫秒），由 gen-burst-tts.py 生成；
 *     buildTimeline 看到这个字段即按实测时长推算每题 present/reveal/pause 段，
 *     确保 TTS 口播完整不被打断。没传时退回字/秒估算（兼容老剪映手工配音）。
 *   - outroHookMs: 片尾 outro.hook 口播的实测时长（毫秒）。有值时片尾时长自动按
 *     「实测 + 2s 缓冲」兜底，确保「你全对了吗…」念完再结束。没传时保持 timing.outroSeconds。
 */
type RenderProps = {
  data: QuizData;
  audioMeasurements?: AudioMeasurements;
  outroHookMs?: number;
};

/**
 * 根据渲染时传入的 props.data 动态重算时长与帧率。
 * 让 render 脚本能通过 `--props`（指向一个含 data 的 JSON 文件）渲染任意题库文件，
 * 而不再把合成时长写死成默认导入的 questions.json。
 * BurstQuiz 合成强制零片头（对齐合成内组件的处理），保证元数据与画面一致。
 */
const calcTimeline: CalculateMetadataFunction<RenderProps> = ({ props }) => {
  const effectiveData: QuizData = {
    ...props.data,
    timing: { ...props.data.timing, introSeconds: 0 },
  };
  const timeline = buildTimeline(effectiveData, {
    audioMeasurements: props.audioMeasurements,
    outroHookMs: props.outroHookMs,
  });
  return {
    durationInFrames: timeline.totalFrames,
    fps: timeline.fps,
    props: { ...props, data: effectiveData },
  };
};

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
