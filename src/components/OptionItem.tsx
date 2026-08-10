import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideIn, popIn } from "../animations";

export type OptionState = "idle" | "correct" | "wrong";

export type OptionItemProps = {
  /** A / B / C / D */
  label: string;
  /** 选项文案 */
  text: string;
  /** 入场起始帧 */
  startFrame?: number;
  /** 揭晓后的状态 */
  state?: OptionState;
  /** 揭晓动画起始帧（state 变化的时间点） */
  revealFrame?: number;
  height?: number;
  fontSize?: number;
};

/** 单个选项行：字母徽标 + 文案，支持答案揭晓时高亮/淡出 */
export const OptionItem: React.FC<OptionItemProps> = ({
  label,
  text,
  startFrame = 0,
  state = "idle",
  revealFrame = 0,
  height = 132,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize: fs } = THEME;

  const enter = fadeSlideIn(frame, startFrame, 16, 44);
  const size = fontSize ?? (text.length > 12 ? fs.option - 6 : fs.option);

  const revealed = state !== "idle" && frame >= revealFrame;
  const revealT = revealed
    ? interpolate(frame, [revealFrame, revealFrame + 14], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const isCorrect = state === "correct";
  const correctPop = isCorrect ? popIn(frame, fps, revealFrame, 10, 200) : 0;

  // 底色 / 边框 / 文字色随揭晓插值
  const bg = isCorrect
    ? `rgba(67, 176, 124, ${0.10 + 0.20 * revealT})`
    : colors.glass;
  const border = isCorrect
    ? `rgba(67, 176, 124, ${0.35 + 0.55 * revealT})`
    : colors.glassBorder;
  const opacity = state === "wrong" ? 1 - 0.62 * revealT : 1;
  const scale = isCorrect ? 1 + 0.045 * correctPop : 1;

  return (
    <div
      style={{
        height,
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: "0 30px",
        borderRadius: 22,
        backgroundColor: bg,
        border: `2px solid ${border}`,
        backdropFilter: "blur(2px)",
        boxShadow: isCorrect
          ? `0 0 ${34 * revealT}px rgba(67,176,124,${0.45 * revealT})`
          : "none",
        opacity: (enter.opacity as number) * opacity,
        transform: `${enter.transform} scale(${scale})`,
      }}
    >
      {/* 字母徽标 */}
      <div
        style={{
          flex: "0 0 auto",
          width: 70,
          height: 70,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.number,
          fontSize: fs.optionLabel,
          fontWeight: 700,
          color: isCorrect ? "#08221A" : colors.gold,
          backgroundColor: isCorrect
            ? `rgba(67, 176, 124, ${0.35 + 0.65 * revealT})`
            : "rgba(229, 185, 107, 0.14)",
          border: `2px solid ${
            isCorrect ? "rgba(67,176,124,0.9)" : "rgba(229,185,107,0.45)"
          }`,
        }}
      >
        {label}
      </div>

      <span
        style={{
          fontFamily: fonts.serif,
          fontSize: size,
          fontWeight: 600,
          color: isCorrect ? "#E8FFF4" : colors.light,
          letterSpacing: 1,
        }}
      >
        {text}
      </span>

      {/* 正确标记 */}
      {isCorrect ? (
        <span
          style={{
            marginLeft: "auto",
            fontFamily: fonts.sans,
            fontSize: 46,
            color: colors.jade,
            opacity: revealT,
            transform: `scale(${0.6 + 0.4 * correctPop})`,
          }}
        >
          ✓
        </span>
      ) : null}
    </div>
  );
};
