import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { Header } from "../components/Header";
import { CountdownRing } from "../components/CountdownRing";
import { QuestionCard } from "../components/QuestionCard";
import { OptionItem, type OptionState } from "../components/OptionItem";
import { AnswerReveal } from "../components/AnswerReveal";
import { QuestionSoundEffects } from "../components/QuestionSoundEffects";
import { QuestionVoiceTracks } from "../components/QuestionVoiceTracks";
import { stagger } from "../animations";
import type { QuestionSlot, QuizData } from "../types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type QuestionSceneProps = {
  slot: QuestionSlot;
  total: number;
  meta: QuizData["meta"];
};

/**
 * 单题场景（三段式）：
 *  ① 呈现  presentFrames  —— 题干语音+题干与选项依次入场
 *  ② 作答  countdownFrames —— 倒计时环走秒
 *  ③ 揭晓  revealFrames    —— 正解高亮 + 解析滑入
 */
export const QuestionScene: React.FC<QuestionSceneProps> = ({
  slot,
  total,
  meta,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, layout } = THEME;
  const { question, index, presentFrames, countdownFrames, durationInFrames } = slot;

  const countdownStart = presentFrames;
  const revealStart = presentFrames + countdownFrames;
  const revealed = frame >= revealStart;

  // 场景整体的出场淡出（与下一题之间做交叉过渡）
  const outFade = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const inFade = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: inFade * outFade }}>
      <QuestionSoundEffects
        presentFrames={presentFrames}
        countdownFrames={countdownFrames}
      />
      <QuestionVoiceTracks
        questionId={question.id}
        answerStartFrame={revealStart}
      />

      <Header
        series={meta.series}
        episodeLabel={meta.episodeLabel}
        counter={`${index + 1} / ${total}`}
      />

      {/* 倒计时环 */}
      <div
        style={{
          position: "absolute",
          top: 214,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <CountdownRing
          seconds={countdownFrames / fps}
          startFrame={countdownStart}
          size={236}
          caption={revealed ? "已揭晓" : "作答中"}
          keepAfterEnd
        />
      </div>

      {/* 题干卡片 */}
      <div
        style={{
          position: "absolute",
          top: 496,
          left: layout.sideMargin,
          right: layout.sideMargin,
        }}
      >
        <QuestionCard stem={question.stem} number={index + 1} startFrame={0} height={300} />
      </div>

      {/* 选项 */}
      <div
        style={{
          position: "absolute",
          top: 836,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {question.options.map((text, i) => {
          const state: OptionState = !revealed
            ? "idle"
            : i === question.answerIndex
            ? "correct"
            : "wrong";
          return (
            <OptionItem
              key={`${question.id}-${i}`}
              label={LETTERS[i]}
              text={text}
              startFrame={stagger(i, 8, 12)}
              state={state}
              revealFrame={revealStart}
              height={132}
            />
          );
        })}
      </div>

      {/* 答案揭晓 + 解析 */}
      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom,
          left: layout.sideMargin,
          right: layout.sideMargin,
        }}
      >
        <AnswerReveal
          answerLabel={LETTERS[question.answerIndex]}
          explanation={question.explanation}
          startFrame={revealStart}
          height={290}
        />
      </div>

      {/* 未揭晓时底部的提示条 */}
      {!revealed ? (
        <div
          style={{
            position: "absolute",
            bottom: layout.safeBottom + 110,
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: THEME.fonts.sans,
            fontSize: 30,
            letterSpacing: 6,
            color: colors.muted,
            opacity: interpolate(frame, [20, 40], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          心里默选一个答案 →
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
