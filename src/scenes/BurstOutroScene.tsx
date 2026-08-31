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
  /** 极简片尾：不渲染任何文字（全对=学霸 / CTA / 落款），只留背景 + BGM，
   *  供用户在剪映自行导入钩子图/答案图；缺省 false 渲染完整文字版 */
  minimal?: boolean;
};

/**
 * 爆款快闪片尾（评级版，约 8 秒）：
 * 「看看你的段位」+ 中国文化评级表（答对 X 题 = 称号，逐行入场）
 * + 看答案引导 + 一行 CTA（点赞·收藏·关注）。
 * minimal 模式（timing.minimalOutro = true 时启用）：画面零文字，仅背景+BGM，
 * 用于发布时自行导入钩子图/答案图到结尾。
 */
export const BurstOutroScene: React.FC<BurstOutroSceneProps> = ({
  outro,
  meta,
  badge,
  durationInFrames,
  minimal = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, fontSize, layout } = THEME;

  // 极简片尾：整段静场，画面只有背景（背景在合成外层 Sequence 之外），无需渲染任何元素
  if (minimal) {
    return <AbsoluteFill />;
  }

  const ctaPop = popIn(frame, fps, 28, 11, 190);
  const breathe = 1 + 0.02 * Math.sin((frame - 28) / 7);

  // 评级表：scoreHints 文案形如「答对 4 题 · 小有才学」，拆成「答对 X 题」+ 称号
  const ratings = (outro.scoreHints ?? [])
    .map((s) => {
      const idx = s.lastIndexOf("·");
      return idx >= 0
        ? { count: s.slice(0, idx).trim(), title: s.slice(idx + 1).trim() }
        : { count: s, title: "" };
    })
    .filter((r) => r.count || r.title);

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
        gap: 30,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: 6,
          color: colors.light,
          textAlign: "center",
          ...fadeSlideUp(frame, 2, 12, 30),
        }}
      >
        {outro.headline || badge}
      </h2>

      {/* 中国文化评级表（逐行入场） */}
      {ratings.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            padding: "30px 52px",
            borderRadius: 26,
            border: `2px solid ${colors.glassBorder}`,
            backgroundColor: colors.glass,
          }}
        >
          {ratings.map((r, i) => {
            const rowIn = interpolate(
              frame,
              [8 + i * 6, 8 + i * 6 + 12],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 14,
                  opacity: rowIn,
                  transform: `translateY(${interpolate(
                    frame,
                    [8 + i * 6, 8 + i * 6 + 12],
                    [16, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  )}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 42,
                    color: colors.ink,
                  }}
                >
                  {r.count}
                </span>
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 56,
                    fontWeight: 800,
                    letterSpacing: 3,
                    color: colors.vermilion,
                  }}
                >
                  {r.title}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 看答案引导（可选：有 answerHint 才显示，提示观众别错过结尾的答案图） */}
      {outro.answerHint ? (
        <div
          style={{
            fontFamily: fonts.sans,
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: 4,
            color: colors.gold,
            textAlign: "center",
            whiteSpace: "pre-line",
            ...fadeSlideUp(frame, 16, 12, 26),
          }}
        >
          {outro.answerHint}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          padding: "24px 56px",
          borderRadius: 999,
          background:
            "linear-gradient(100deg, rgba(229,185,107,0.95), rgba(201,162,90,0.95))",
          boxShadow: "0 18px 48px rgba(229,185,107,0.28)",
          transform: `scale(${(0.7 + 0.3 * ctaPop) * breathe})`,
          opacity: ctaPop,
        }}
      >
        <span style={{ fontSize: 42 }}>👍</span>
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: 54,
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
          opacity: interpolate(frame, [40, durationInFrames], [0, 1], {
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
