import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp, popIn, sceneFade } from "../animations";
import type { QuizData } from "../types";

export type IntroSceneProps = {
  intro: QuizData["intro"];
  meta: QuizData["meta"];
  durationInFrames: number;
};

/** 片头：栏目印 → 主标题 → 副标题 → 玩法提示 */
export const IntroScene: React.FC<IntroSceneProps> = ({
  intro,
  meta,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;

  const opacity = sceneFade(frame, durationInFrames, 10, 14);
  const seal = popIn(frame, fps, 2, 10, 180);

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
        gap: 34,
      }}
    >
      <Img
        src={staticFile("assets/seal-mark.svg")}
        style={{
          width: 132,
          height: 132,
          opacity: seal,
          transform: `scale(${0.5 + 0.5 * seal}) rotate(${interpolate(
            seal,
            [0, 1],
            [-18, -6]
          )}deg)`,
        }}
      />

      <div
        style={{
          fontFamily: fonts.sans,
          fontSize: fontSize.kicker,
          letterSpacing: 14,
          color: colors.gold,
          ...fadeSlideUp(frame, 8, 16, 24),
        }}
      >
        {intro.kicker}
      </div>

      <h1
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: fontSize.heroTitle,
          fontWeight: 800,
          lineHeight: 1.32,
          letterSpacing: 4,
          color: colors.light,
          textAlign: "center",
          whiteSpace: "pre-line",
          textShadow: "0 2px 18px rgba(46,36,24,0.12)",
          ...fadeSlideUp(frame, 16, 20, 40),
        }}
      >
        {intro.title}
      </h1>

      <div
        style={{
          width: 260,
          height: 3,
          background:
            "linear-gradient(90deg, rgba(229,185,107,0), rgba(229,185,107,0.9), rgba(229,185,107,0))",
          opacity: interpolate(frame, [28, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <p
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: fontSize.heroSub,
          color: colors.light,
          textAlign: "center",
          lineHeight: 1.6,
          ...fadeSlideUp(frame, 34, 18, 26),
        }}
      >
        {intro.subtitle}
      </p>

      <div
        style={{
          marginTop: 18,
          padding: "16px 34px",
          borderRadius: 999,
          border: `2px solid ${colors.glassBorder}`,
          backgroundColor: colors.glass,
          fontFamily: fonts.sans,
          fontSize: 30,
          letterSpacing: 4,
          color: colors.gold,
          ...fadeSlideUp(frame, 46, 18, 22),
        }}
      >
        {intro.hint}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom,
          fontFamily: fonts.kai,
          fontSize: 28,
          letterSpacing: 3,
          color: colors.muted,
          opacity: interpolate(frame, [52, 70], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {meta.hostTag} · {meta.episodeLabel}
      </div>
    </AbsoluteFill>
  );
};
