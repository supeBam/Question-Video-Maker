import React from "react";
import { Composition } from "remotion";
import { LiteratureQuiz } from "./LiteratureQuiz";
import { buildTimeline, type QuizData } from "./types";
import { THEME } from "./theme";
import quizData from "./data/questions.json";

const data = quizData as QuizData;
const timeline = buildTimeline(data);

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
    </>
  );
};
