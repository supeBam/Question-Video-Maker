import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp, popIn } from "../animations";
import type { QuizData } from "../types";

export type BurstOutroSceneProps = {
  outro: QuizData["outro"];
  meta: QuizData["meta"];
  badge: string;
  durationInFrames: number;
};

/**
 * 爆款快闪片尾（约 3 秒，对标系列视频片尾几乎无停留）：
 * 大字结果承诺（「全对 = 学霸」）+ 一行 CTA（点赞·收藏·关注）。
 * 收藏指令在这里收口——对标把「收藏」写进标题，我们把「收藏」收在片尾 + 底部常驻条。
 */
export const BurstOutroScene: React.FC<BurstOutroSceneProps> = ({
  outro,
  meta,
  badge,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;

  const ctaPop = popIn(frame, fps, 16, 11, 190);
  const breathe = 1 + 0.02 * Math.sin((frame - 16) / 7);

  return (
    <AbsoluteFill
      style={{
        paddingTop: layout.safeTop,
        paddingBottom: layout.safeBottom,
        paddingLeft: layout.sideMargin,
        paddingRight: layout.sideMargin,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: 6,
          color: colors.light,
          textAlign: "center",
          ...fadeSlideUp(frame, 2, 12, 30),
        }}
      >
        {outro.headline || badge}
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "28px 64px",
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
            fontSize: 60,
            fontWeight: 800,
            letterSpacing: 4,
            color: "#20160A",
          }}
        >
          {outro.cta}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom - 30,
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: interpolate(frame, [28, durationInFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
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
