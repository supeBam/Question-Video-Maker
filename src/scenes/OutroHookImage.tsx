import React from "react";
import { AbsoluteFill } from "remotion";
import { THEME } from "../theme";
import { Background } from "../components/Background";
import type { QuizData } from "../types";

export type OutroHookImageProps = {
  data: QuizData;
};

/** 按句号/问号/叹号/换行把钩子拆成行，用于竖排大字排版 */
const splitHook = (hook: string) =>
  hook
    .split(/(?<=[。！？!?])|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 片尾钩子图（仅用于 still 渲染成 PNG，不进视频）：
 * 把 outro.hook 口播钩子（如「你全对了吗？评论区告诉我。点赞收藏，考考孩子。」）
 * 排版成宣纸风竖屏大字图，供发布时作为配图 / 评论区置顶图 / 结尾贴图使用。
 * 静态画面：不使用动画，保证 still 单帧即为完整终态。
 */
export const OutroHookImage: React.FC<OutroHookImageProps> = ({ data }) => {
  const { colors, fonts, layout } = THEME;
  const badge = data.publish?.badge ?? "全对 = 学霸";
  const hook = data.outro?.hook ?? "";
  const cta = data.outro?.cta ?? "点赞 · 收藏 · 关注";
  const hostTag = data.meta?.hostTag ?? "";
  const background = data.background;

  const lines = splitHook(hook);
  // 字号自适应：行越长字越小，避免超出安全区
  const maxLineLen = Math.max(...lines.map((l) => l.length), 1);
  const fontSize = Math.round(Math.min(88, 1500 / maxLineLen));

  return (
    <AbsoluteFill>
      <Background
        src={background?.src ?? "assets/bg-paper.svg"}
        cloudSrc={background?.cloudSrc ?? "assets/cloud-pattern.svg"}
        drift={0}
      />
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
          gap: 48,
        }}
      >
        {/* 顶部激励角标 */}
        <div
          style={{
            padding: "20px 56px",
            borderRadius: 999,
            border: `3px solid ${colors.gold}`,
            backgroundColor: colors.glass,
            fontFamily: fonts.sans,
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: 6,
            color: colors.vermilion,
          }}
        >
          {badge}
        </div>

        {/* 钩子大字（居中，每句一行） */}
        <h1
          style={{
            margin: 0,
            fontFamily: fonts.serif,
            fontSize,
            fontWeight: 800,
            lineHeight: 1.5,
            letterSpacing: 4,
            color: colors.light,
            textAlign: "center",
            whiteSpace: "pre-line",
          }}
        >
          {lines.join("\n")}
        </h1>

        {/* 底部 CTA + 落款 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              padding: "24px 58px",
              borderRadius: 999,
              background:
                "linear-gradient(100deg, rgba(229,185,107,0.95), rgba(201,162,90,0.95))",
              fontFamily: fonts.sans,
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: 4,
              color: "#20160A",
            }}
          >
            {cta}
          </div>
          <span
            style={{
              fontFamily: fonts.kai,
              fontSize: 30,
              letterSpacing: 3,
              color: colors.muted,
            }}
          >
            {hostTag}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
