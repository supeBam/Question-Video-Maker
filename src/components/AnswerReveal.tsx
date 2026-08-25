import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp, popIn } from "../animations";

export type AnswerRevealProps = {
  /** 正确答案字母，如 "A" */
  answerLabel: string;
  /** 解析文案 */
  explanation: string;
  /** 揭晓起始帧 */
  startFrame: number;
  /** 前缀文案 */
  prefix?: string;
  /** 面板最小高度（解析文字超长时自动向上撑高） */
  minHeight?: number;
  /** 印章静态资源，传 null 关闭 */
  sealSrc?: string | null;
};

/** 答案揭晓条：朱砂印章 + 「正确答案 X」+ 解析 */
export const AnswerReveal: React.FC<AnswerRevealProps> = ({
  answerLabel,
  explanation,
  startFrame,
  prefix = "正确答案",
  minHeight = 290,
  sealSrc = "assets/seal-mark.svg",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize } = THEME;

  if (frame < startFrame) return null;

  const box = fadeSlideUp(frame, startFrame, 16, 26);
  const seal = popIn(frame, fps, startFrame + 4, 9, 190);
  const sealRotate = interpolate(seal, [0, 1], [-24, -8]);
  const explainAnim = fadeSlideUp(frame, startFrame + 12, 18, 18);

  return (
    <div
      style={{
        minHeight,
        borderRadius: 26,
        backgroundColor: colors.paper,
        border: `2px solid ${colors.glassBorder}`,
        boxShadow: "0 12px 40px rgba(46,36,24,0.16)",
        padding: "30px 34px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        position: "relative",
        overflow: "hidden",
        ...box,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {sealSrc ? (
          <Img
            src={staticFile(sealSrc)}
            style={{
              width: 84,
              height: 84,
              transform: `rotate(${sealRotate}deg) scale(${0.4 + 0.6 * seal})`,
              opacity: seal,
            }}
          />
        ) : null}
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: fontSize.explain,
            letterSpacing: 6,
            color: colors.muted,
          }}
        >
          {prefix}
        </span>
        <span
          style={{
            fontFamily: fonts.number,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1,
            color: colors.jade,
            textShadow: "0 0 26px rgba(67,176,124,0.45)",
            transform: `scale(${0.7 + 0.3 * seal})`,
          }}
        >
          {answerLabel}
        </span>
      </div>

      <div
        style={{
          height: 2,
          background:
            "linear-gradient(90deg, rgba(229,185,107,0.55), rgba(229,185,107,0))",
        }}
      />

      <p
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: fontSize.explain,
          lineHeight: 1.6,
          color: colors.light,
          ...explainAnim,
        }}
      >
        {explanation}
      </p>
    </div>
  );
};
