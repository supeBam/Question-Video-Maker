import React from "react";
import { Composition } from "remotion";
import { LiteratureQuiz } from "./LiteratureQuiz";
import { buildTimeline, type QuizData } from "./types";
import { THEME } from "./theme";
import quizData from "./data/questions.json";
import crosswordData from "./data/questions-crossword-demo.json";
import wanwuData from "./data/questions-wanwu-yacheng.json";

const data = quizData as QuizData;
const timeline = buildTimeline(data);

// 诗词填字纵横示例（选择题 + 诗词填字混排）
const crossData = crosswordData as QuizData;
const crossTimeline = buildTimeline(crossData);

// 万物雅称（填空题专题）
const wanwu = wanwuData as QuizData;
const wanwuTimeline = buildTimeline(wanwu);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LiteratureQuiz"
        component={LiteratureQuiz}
        durationInFrames={timeline.totalFrames}
        fps={timeline.fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data }}
      />
      <Composition
        id="CrosswordQuiz"
        component={LiteratureQuiz}
        durationInFrames={crossTimeline.totalFrames}
        fps={crossTimeline.fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: crossData }}
      />
      <Composition
        id="WanwuYacheng"
        component={LiteratureQuiz}
        durationInFrames={wanwuTimeline.totalFrames}
        fps={wanwuTimeline.fps}
        width={THEME.layout.width}
        height={THEME.layout.height}
        defaultProps={{ data: wanwu }}
      />
    </>
  );
};
