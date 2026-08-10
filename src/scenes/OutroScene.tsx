import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp, popIn, sceneFade, stagger } from "../animations";
import type { QuizData } from "../types";

export type OutroSceneProps = {
  outro: QuizData["outro"];
  meta: QuizData["meta"];
  durationInFrames: number;
};

/** 片尾：成绩自评 → 点赞关注 CTA → 账号落款 */
export const OutroScene: React.FC<OutroSceneProps> = ({
  outro,
  meta,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;

  const opacity = sceneFade(frame, durationInFrames, 12, 16);
  const ctaPop = popIn(frame, fps, 46, 11, 190);
  // CTA 轻微呼吸
  const breathe = 1 + 0.018 * Math.sin((frame - 46) / 7);

  return (
    <AbsoluteFill
      style={{
        opacity,
        paddingTop: layout.safeTop,
        paddingBottom: layout.safeBottom,
        paddingLeft: layout.sideMargin,
        paddingRight: layout.sideMargin,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: fontSize.outroTitle,
          fontWeight: 800,
          letterSpacing: 4,
          color: colors.light,
          textAlign: "center",
          textShadow: "0 10px 34px rgba(0,0,0,0.5)",
          ...fadeSlideUp(frame, 4, 18, 34),
        }}
      >
        {outro.headline}
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          width: "100%",
          maxWidth: 820,
          marginTop: 8,
        }}
      >
        {outro.scoreHints.map((hint, i) => (
          <div
            key={hint}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              padding: "20px 30px",
              borderRadius: 18,
              backgroundColor: colors.glass,
              border: `2px solid ${colors.glassBorder}`,
              fontFamily: fonts.serif,
              fontSize: fontSize.outroItem,
              color: colors.light,
              ...fadeSlideUp(frame, stagger(i, 9, 16), 16, 24),
            }}
          >
            <span style={{ color: colors.gold, fontSize: 30 }}>◆</span>
            {hint}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 26,
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "26px 62px",
          borderRadius: 999,
          background:
            "linear-gradient(100deg, rgba(229,185,107,0.95), rgba(201,162,90,0.95))",
          boxShadow: "0 18px 48px rgba(229,185,107,0.28)",
          transform: `scale(${(0.7 + 0.3 * ctaPop) * breathe})`,
          opacity: ctaPop,
        }}
      >
        <span style={{ fontSize: 46 }}>👍</span>
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: fontSize.cta,
            fontWeight: 800,
            letterSpacing: 4,
            color: "#20160A",
          }}
        >
          {outro.cta}
        </span>
      </div>

      <p
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: 34,
          color: colors.light,
          opacity: 0.85,
          textAlign: "center",
          ...fadeSlideUp(frame, 62, 18, 20),
        }}
      >
        {outro.ctaSub}
      </p>

      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom - 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
          opacity: interpolate(frame, [70, 88], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <Img src={staticFile("assets/seal-mark.svg")} style={{ width: 54, height: 54 }} />
        <span
          style={{
            fontFamily: fonts.kai,
            fontSize: 30,
            letterSpacing: 3,
            color: colors.muted,
          }}
        >
          {meta.hostTag}
        </span>
      </div>
    </AbsoluteFill>
  );
};
