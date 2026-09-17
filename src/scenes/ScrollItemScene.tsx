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
  /** 反差陈述式：有 youThink/actually 时切换为「你以为 / 实际」对比版式，大字改横排 */
  const isContrast = Boolean(item.youThink && item.actually);
  const bigSize = chars.length <= 4 ? 148 : chars.length <= 6 ? 118 : 94;
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
  /**
   * 反差式时序：先抛「你以为」→ 悬停 → 再揭「实际」。
   * 这是把"讲述"变成"铺陈 → 翻牌"的关键：观众先认同自己的误读，
   * 停顿 1.4 秒让心里冒出问号，朱砂答案才砸得下去。
   * （同时出 = 观众只是听，不构成任何心理参与）
   */
  const thinkStart = Math.round(1.2 * fps);
  const actualStart = Math.round(2.6 * fps);

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
        {item.label ?? `${item.noun} · 古人称它`}
      </div>

      {/* 中央偏上：雅称大字（竖排逐字浮现） */}
      <div
        style={{
          position: "absolute",
          top: isContrast ? 470 : 430,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          padding: "0 48px",
          transform: `translateY(${rise(0, 44)}px)`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isContrast ? "row" : "column",
            gap: isContrast ? 10 : 44,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {chars.map((ch, i) => (
            <div
              key={i}
              style={{
                fontFamily: THEME.fonts.kai,
                fontSize: isContrast ? bigSize : 210,
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
          {item.stamp ?? "雅"}
        </div>
      </div>

      {/* 中下：反差式 = 「你以为 / 实际」对比双栏；雅称式 = 诗句 + 作者 */}
      {isContrast ? (
        <>
          <div
            style={{
              position: "absolute",
              top: 1060,
              width: "100%",
              display: "flex",
              padding: "0 56px",
            }}
          >
            {/* 左栏：先出。观众先认同"我也是这么以为的" */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                paddingRight: 24,
                borderRight: "2px solid rgba(46,36,24,0.18)",
                opacity: fade(thinkStart),
                transform: `translateY(${rise(thinkStart, 20)}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: THEME.fonts.serif,
                  fontSize: 44,
                  // 不用 muted：太淡，45+ 用户在手机上几乎看不清
                  color: "rgba(46,36,24,0.72)",
                  letterSpacing: 6,
                }}
              >
                你以为
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: THEME.fonts.kai,
                  fontSize: 60,
                  color: "rgba(46,36,24,0.72)",
                  lineHeight: 1.35,
                  textDecoration: "line-through",
                  textDecorationColor: "rgba(46,36,24,0.55)",
                }}
              >
                {item.youThink}
              </div>
            </div>
            {/* 右栏：1.4 秒后砸下来（朱砂 + 弹入），制造揭晓冲击 */}
            <div
              style={{
                flex: 1,
                textAlign: "center",
                paddingLeft: 24,
                opacity: fade(actualStart, Math.round(0.35 * fps)),
                transform: `scale(${interpolate(
                  frame,
                  [actualStart, actualStart + Math.round(0.45 * fps)],
                  [0.78, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                )})`,
              }}
            >
              <div
                style={{
                  fontFamily: THEME.fonts.serif,
                  fontSize: 44,
                  color: THEME.colors.vermilion,
                  letterSpacing: 6,
                }}
              >
                实际
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontFamily: THEME.fonts.kai,
                  fontSize: 60,
                  fontWeight: 700,
                  color: THEME.colors.vermilion,
                  lineHeight: 1.35,
                }}
              >
                {item.actually}
              </div>
            </div>
          </div>
          {item.source ? (
            <div
              style={{
                position: "absolute",
                top: 1400,
                width: "100%",
                textAlign: "center",
                fontFamily: THEME.fonts.serif,
                fontSize: 34,
                color: THEME.colors.muted,
                letterSpacing: 3,
                opacity: fade(actualStart + Math.round(0.4 * fps)),
              }}
            >
              {item.source}
            </div>
          ) : null}
        </>
      ) : (
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
      )}

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
