import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { THEME } from "../theme";
import { BurstChrome } from "../components/BurstChrome";
import { stagger } from "../animations";
import type {
  ChoiceQuestion,
  FillQuestion,
  QuestionSlot,
  QuizData,
} from "../types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type SummarySceneProps = {
  slots: QuestionSlot[];
  meta: QuizData["meta"];
  badge: string;
  saveText?: string;
  disclaimer?: string;
  durationInFrames: number;
};

/** 题干压成一行（去掉换行，超长截断） */
const oneLineStem = (stem: string) => {
  const flat = stem.replace(/\n/g, " ");
  return flat.length > 26 ? flat.slice(0, 26) + "…" : flat;
};

/** 答案（选择题显示字母+选项，填空题显示雅称） */
const answerOf = (slot: QuestionSlot): string => {
  if (slot.kind === "fill") {
    return (slot.question as FillQuestion).answer;
  }
  const q = slot.question as ChoiceQuestion;
  return `${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}`;
};

/**
 * 片尾「本期答案」回顾（快闪模板专属，仅画面、不进字幕）：
 * 逐题展示 题干 → 答案（大字）→ 解释，字号为老年观众加大。
 */
export const SummaryScene: React.FC<SummarySceneProps> = ({
  slots,
  meta,
  badge,
  saveText,
  disclaimer,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { colors, fonts, fontSize, layout } = THEME;

  const inFade = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outFade = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ opacity: inFade * outFade }}>
      <BurstChrome
        series={meta.series}
        badge={badge}
        saveText={saveText}
        disclaimer={disclaimer}
      />

      {/* 标题 */}
      <div
        style={{
          position: "absolute",
          top: 240,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
        }}
      >
        <span
          style={{
            fontFamily: fonts.serif,
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: 8,
            color: colors.light,
          }}
        >
          本期答案
        </span>
        <div
          style={{
            width: 260,
            height: 3,
            background:
              "linear-gradient(90deg, rgba(229,185,107,0), rgba(229,185,107,0.9), rgba(229,185,107,0))",
          }}
        />
      </div>

      {/* 逐题卡片 */}
      <div
        style={{
          position: "absolute",
          top: 400,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {slots.map((slot, i) => {
          const enter = interpolate(
            frame,
            [stagger(i, 7, 4), stagger(i, 7, 4) + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const explanation =
            slot.kind === "fill"
              ? (slot.question as FillQuestion).explanation
              : (slot.question as ChoiceQuestion).explanation;
          const stem = slot.question.stem;
          return (
            <div
              key={slot.question.id}
              style={{
                opacity: enter,
                transform: `translateY(${interpolate(
                  frame,
                  [stagger(i, 7, 4), stagger(i, 7, 4) + 12],
                  [18, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )}px)`,
                borderRadius: 22,
                backgroundColor: colors.paper,
                border: `2px solid ${colors.glassBorder}`,
                padding: "20px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.number,
                    fontSize: 40,
                    color: colors.gold,
                    fontWeight: 700,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: fonts.serif,
                    fontSize: 44,
                    fontWeight: 600,
                    letterSpacing: 2,
                    color: colors.light,
                  }}
                >
                  {oneLineStem(stem)}
                </span>
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 52,
                    fontWeight: 800,
                    color: colors.jade,
                  }}
                >
                  {answerOf(slot)}
                </span>
              </div>
              <div
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 38,
                  lineHeight: 1.5,
                  color: colors.muted,
                }}
              >
                {explanation}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
