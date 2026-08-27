import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { THEME } from "../theme";
import { Header } from "../components/Header";
import { CountdownRing } from "../components/CountdownRing";
import { QuestionCard } from "../components/QuestionCard";
import { QuestionSoundEffects } from "../components/QuestionSoundEffects";
import { fadeSlideUp, popIn } from "../animations";
import type { FillQuestion, QuestionSlot, QuizData } from "../types";

export type FillSceneProps = {
  slot: QuestionSlot;
  total: number;
  meta: QuizData["meta"];
  voiceOverEnabled: boolean;
};

/** 答案字号：雅称一般 2~4 个字，按长度自动缩放 */
const answerFontSize = (answer: string) => {
  const len = answer.length;
  if (len <= 2) return 160;
  if (len === 3) return 132;
  return 112;
};

/**
 * 填空题场景（万物雅称，三段式）：
 *  ① 呈现  presentFrames  —— 题干入场
 *  ② 思考  countdownFrames —— 倒计时环 + 「它的雅称是……？」
 *  ③ 揭晓  revealFrames    —— 雅称大字亮出 + 底部解释
 */
export const FillScene: React.FC<FillSceneProps> = ({
  slot,
  total,
  meta,
  voiceOverEnabled,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, layout } = THEME;
  const question = slot.question as FillQuestion;
  const { index, presentFrames, countdownFrames, durationInFrames } = slot;

  const countdownStart = presentFrames;
  const revealStart = presentFrames + countdownFrames;
  const revealed = frame >= revealStart;

  void voiceOverEnabled;

  const inFade = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outFade = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // 揭晓动画：雅称大字盖章式弹入
  const answerPop = popIn(frame, fps, revealStart, 11, 180);
  const answerGlow = interpolate(
    frame,
    [revealStart, revealStart + 14],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity: inFade * outFade }}>
      <QuestionSoundEffects
        presentFrames={presentFrames}
        countdownFrames={countdownFrames}
      />

      <Header
        series={meta.series}
        episodeLabel={meta.episodeLabel}
        counter={`${index + 1} / ${total}`}
      />

      {/* 标签（如「云」「月」） */}
      {question.tag ? (
        <div
          style={{
            position: "absolute",
            top: layout.safeTop + 68,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: fonts.kai,
              fontSize: 36,
              letterSpacing: 10,
              color: colors.gold,
              padding: "6px 26px",
              borderRadius: 999,
              border: `2px solid ${colors.glassBorder}`,
              backgroundColor: colors.glass,
              ...fadeSlideUp(frame, 4, 14, 14),
            }}
          >
            {question.tag}
          </div>
        </div>
      ) : null}

      {/* 题干 */}
      <div
        style={{
          position: "absolute",
          top: 340,
          left: layout.sideMargin,
          right: layout.sideMargin,
        }}
      >
        <QuestionCard
          stem={question.stem}
          number={index + 1}
          startFrame={0}
          height={300}
          fontSize={62}
        />
      </div>

      {/* 思考阶段：倒计时环 + 留白提示（呈现阶段结束后才出现） */}
      {!revealed && frame >= countdownStart ? (
        <div
          style={{
            position: "absolute",
            top: 690,
            left: layout.sideMargin,
            right: layout.sideMargin,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
          }}
        >
          <CountdownRing
            seconds={countdownFrames / fps}
            startFrame={countdownStart}
            size={236}
            caption="思考中"
          />

          <div
            style={{
              width: "100%",
              height: 180,
              borderRadius: 24,
              border: `3px dashed ${colors.glassBorder}`,
              backgroundColor: colors.glass,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              ...fadeSlideUp(frame, countdownStart, 18, 20),
            }}
          >
            <span
              style={{
                fontFamily: fonts.serif,
                fontSize: 54,
                letterSpacing: 8,
                color: colors.muted,
              }}
            >
              它的雅称是……？
            </span>
            {question.hint ? (
              <span
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 40,
                  letterSpacing: 3,
                  color: colors.gold,
                }}
              >
                {question.hint}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* 揭晓阶段：雅称大字 + 解释 */}
      {revealed ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 700,
              left: layout.sideMargin,
              right: layout.sideMargin,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                opacity: interpolate(
                  frame,
                  [revealStart, revealStart + 10],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                ),
              }}
            >
              <Img
                src={staticFile("assets/seal-mark.svg")}
                style={{ width: 56, height: 56, flexShrink: 0 }}
              />
              <span
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 48,
                  letterSpacing: 8,
                  color: colors.muted,
                }}
              >
                雅称
              </span>
            </div>

            <div
              style={{
                fontFamily: fonts.serif,
                fontSize: answerFontSize(question.answer),
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: 12,
                color: colors.jade,
                textShadow: `0 0 ${40 * answerGlow}px rgba(67,176,124,${0.5 * answerGlow})`,
                opacity: answerPop,
                transform: `translateY(${interpolate(
                  frame,
                  [revealStart, revealStart + 28],
                  [28, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )}px) scale(${0.6 + 0.4 * answerPop})`,
              }}
            >
              {question.answer}
            </div>
          </div>

          {/* 底部解释 */}
          <div
            style={{
              position: "absolute",
              bottom: layout.safeBottom,
              left: layout.sideMargin,
              right: layout.sideMargin,
            }}
          >
            <div
              style={{
                minHeight: 360,
                borderRadius: 26,
                backgroundColor: colors.paper,
                border: `2px solid ${colors.glassBorder}`,
                boxShadow: "0 12px 40px rgba(46,36,24,0.16)",
                padding: "36px 40px",
                display: "flex",
                gap: 24,
                alignItems: "flex-start",
                ...fadeSlideUp(frame, revealStart + 12, 18, 24),
              }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.gold,
                  marginTop: 40,
                }}
              />
              <p
                style={{
                  margin: 0,
                  fontFamily: fonts.serif,
                  fontSize: 60,
                  lineHeight: 1.5,
                  color: colors.light,
                }}
              >
                {question.explanation}
              </p>
            </div>
          </div>
        </>
      ) : null}
    </AbsoluteFill>
  );
};
