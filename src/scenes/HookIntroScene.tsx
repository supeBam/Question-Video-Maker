import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp, popIn } from "../animations";

export type HookIntroSceneProps = {
  kicker: string;
  title: string;
  challenge: string;
  durationInFrames: number;
};

/**
 * 快闪模板钩子开场（缺省 2 秒，封面即取此画面）：
 * 栏目小字 → 大字标题 → 挑战词胶囊，快速入场后立刻接第一题。
 * 挑战词是整条视频的钩子（如「10 题 · 答对 8 个算你牛」）。
 */
export const HookIntroScene: React.FC<HookIntroSceneProps> = ({
  kicker,
  title,
  challenge,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;

  const seal = popIn(frame, fps, 0, 10, 180);
  const outFade = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        opacity: outFade,
        paddingTop: layout.safeTop,
        paddingBottom: layout.safeBottom,
        paddingLeft: layout.sideMargin,
        paddingRight: layout.sideMargin,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <Img
        src={staticFile("assets/seal-mark.svg")}
        style={{
          width: 148,
          height: 148,
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
          fontSize: fontSize.kicker + 4,
          letterSpacing: 16,
          color: colors.gold,
          ...fadeSlideUp(frame, 4, 10, 22),
        }}
      >
        {kicker}
      </div>

      <h1
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.34,
          letterSpacing: 4,
          color: colors.light,
          textAlign: "center",
          whiteSpace: "pre-line",
          ...fadeSlideUp(frame, 8, 12, 34),
        }}
      >
        {title}
      </h1>

      <div
        style={{
          marginTop: 12,
          padding: "22px 58px",
          borderRadius: 999,
          border: `3px solid ${colors.gold}`,
          backgroundColor: colors.glass,
          fontFamily: fonts.sans,
          fontSize: 52,
          fontWeight: 700,
          letterSpacing: 5,
          color: colors.vermilion,
          boxShadow: "0 12px 36px rgba(229,185,107,0.22)",
          ...fadeSlideUp(frame, 18, 12, 24),
        }}
      >
        {challenge}
      </div>
    </AbsoluteFill>
  );
};
