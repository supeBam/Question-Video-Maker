import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { THEME } from "../theme";
import type { ScrollItem } from "../ScrollShow";

/**
 * 单条雅称展示场景（画卷流 · 浅底深字版）：
 *   上：noun 小字「山 · 古人称它」
 *   中偏上：雅称大字（竖排，逐字浮现）
 *   中下：诗句 + 作者（楷体金）
 *   下：旁白字幕（烧录，逐行淡入——静音刷视频也能看懂，中老年刚需）
 *   底：页码 + 免责声明
 * 布局用绝对分区，关键内容都落在竖屏中上部（3:4 封面裁剪安全区附近）。
 */
export const ScrollItemScene: React.FC<{
  item: ScrollItem & { captionLines?: string[] };
  index: number;
  total: number;
  episodeLabel: string;
  disclaimer: string;
  durationInFrames: number;
}> = ({ item, index, total, episodeLabel, disclaimer, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chars = item.aka.split("");
  const fade = (start: number, dur = Math.round(0.7 * fps)) =>
    interpolate(frame, [start, start + dur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const rise = (start: number, dist = 36, dur = Math.round(0.9 * fps)) =>
    interpolate(frame, [start, start + dur], [dist, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const nounStart = Math.round(0.3 * fps);
  const poemStart = Math.round(1.4 * fps);
  const captionLines = item.captionLines ?? [];

  return (
    <AbsoluteFill>
      {/* 顶部：栏目 + 事物 */}
      <div
        style={{
          position: "absolute",
          top: THEME.layout.safeTop + 60,
          width: "100%",
          textAlign: "center",
          fontFamily: THEME.fonts.serif,
          fontSize: THEME.fontSize.kicker,
          color: THEME.colors.muted,
          letterSpacing: 8,
          opacity: fade(nounStart),
        }}
      >
        {item.noun} · 古人称它
      </div>

      {/* 中央偏上：雅称大字（竖排逐字浮现） */}
      <div
        style={{
          position: "absolute",
          top: 430,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          transform: `translateY(${rise(0, 44)}px)`,
        }}
      >
        <div style={{ display: "flex", gap: 44 }}>
          {chars.map((ch, i) => (
            <div
              key={i}
              style={{
                fontFamily: THEME.fonts.kai,
                fontSize: 210,
                fontWeight: 700,
                color: THEME.colors.ink,
                lineHeight: 1.05,
                textShadow: "0 2px 10px rgba(255,252,244,0.9)",
                opacity: fade(i * Math.round(0.35 * fps)),
                transform: `scale(${interpolate(
                  frame,
                  [i * Math.round(0.35 * fps), i * Math.round(0.35 * fps) + Math.round(0.7 * fps)],
                  [0.86, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )})`,
              }}
            >
              {ch}
            </div>
          ))}
        </div>
        {/* 朱砂印章点缀 */}
        <div
          style={{
            marginTop: 8,
            width: 62,
            height: 62,
            background: THEME.colors.vermilion,
            color: "#FFFBF2",
            fontFamily: THEME.fonts.kai,
            fontSize: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            opacity: fade(Math.round(0.9 * fps)),
          }}
        >
          雅
        </div>
      </div>

      {/* 中下：诗句 + 作者 */}
      <div
        style={{
          position: "absolute",
          top: 1180,
          width: "100%",
          textAlign: "center",
          opacity: fade(poemStart),
          transform: `translateY(${rise(poemStart, 20)}px)`,
        }}
      >
        <div
          style={{
            fontFamily: THEME.fonts.kai,
            fontSize: 50,
            color: THEME.colors.goldDim,
            lineHeight: 1.5,
            padding: "0 48px",
          }}
        >
          「{item.poem}」
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: THEME.fonts.serif,
            fontSize: 32,
            color: THEME.colors.muted,
            letterSpacing: 4,
          }}
        >
          —— {item.poemAuthor}
        </div>
      </div>

      {/* 下部：旁白字幕（烧录，逐行淡入，静音可读） */}
      <div
        style={{
          position: "absolute",
          bottom: THEME.layout.safeBottom + 120,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          padding: "0 56px",
        }}
      >
        {captionLines.map((line, i) => {
          const start = Math.round((0.6 + i * 1.2) * fps);
          return (
            <div
              key={i}
              style={{
                fontFamily: THEME.fonts.sans,
                fontSize: 44,
                fontWeight: 600,
                color: THEME.colors.ink,
                lineHeight: 1.4,
                textAlign: "center",
                opacity: fade(start, Math.round(0.5 * fps)),
                transform: `translateY(${rise(start, 14, Math.round(0.6 * fps))}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>

      {/* 底部：页码 + 免责声明 */}
      <div
        style={{
          position: "absolute",
          bottom: THEME.layout.safeBottom - 70,
          width: "100%",
          textAlign: "center",
          fontFamily: THEME.fonts.sans,
          fontSize: 26,
          color: THEME.colors.muted,
          opacity: 0.85,
        }}
      >
        {episodeLabel} · {index + 1}/{total}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 40,
          width: "100%",
          textAlign: "center",
          fontFamily: THEME.fonts.sans,
          fontSize: 24,
          color: "rgba(46,36,24,0.45)",
        }}
      >
        {disclaimer}
      </div>
    </AbsoluteFill>
  );
};
