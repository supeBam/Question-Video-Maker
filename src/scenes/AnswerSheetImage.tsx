import React from "react";
import { AbsoluteFill } from "remotion";
import { THEME } from "../theme";
import { Background } from "../components/Background";
import { computeAnswerPages } from "../answerSheet";
import type { QuizData } from "../types";

export type AnswerSheetImageProps = {
  data: QuizData;
  /** 第几页（0-based），缺省 0；页数由 computeAnswerPages 决定 */
  pageIndex?: number;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const stemFontSize = (stem: string) => {
  const len = stem.replace(/\n/g, "").length;
  if (len <= 16) return 44;
  if (len <= 24) return 40;
  return 36;
};

/**
 * 答案解释图（仅用于 still 渲染成 PNG，不进视频）：
 * 竖屏宣纸风，把本期「题号 + 题干 + 答案 + 解释」排版成图，
 * 用于放在视频结尾 / 发布配图。内容多时由 computeAnswerPages 分页，
 * 每页渲染一张 PNG（out/<期号>-答案-第N页.png）。
 * 静态画面：不使用动画，保证 still 单帧即为完整终态。
 */
export const AnswerSheetImage: React.FC<AnswerSheetImageProps> = ({
  data,
  pageIndex = 0,
}) => {
  const { colors, fonts, layout } = THEME;
  const pages = computeAnswerPages(data.questions);
  const page = pages[pageIndex] ?? { indices: [] };
  const total = pages.length;
  const background = data.background;

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
        }}
      >
        {/* 页头：栏目期号 + 标题 + 页码 */}
        <div style={{ flexShrink: 0, paddingBottom: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 28,
                letterSpacing: 6,
                color: colors.gold,
              }}
            >
              {data.meta.series} · {data.meta.episodeLabel}
            </span>
            <span
              style={{
                fontFamily: fonts.number,
                fontSize: 26,
                color: colors.muted,
              }}
            >
              {total > 1 ? `${pageIndex + 1} / ${total}` : ""}
            </span>
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: fonts.serif,
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: 4,
              color: colors.light,
            }}
          >
            本期答案
          </div>
          <div
            style={{
              marginTop: 10,
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${colors.gold}, rgba(185,132,54,0.15))`,
            }}
          />
        </div>

        {/* 题目区（flex:1 内滚动排版，每页内容由 computeAnswerPages 限定，不会溢出） */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 26,
            overflow: "hidden",
          }}
        >
          {page.indices.map((qi, idx) => {
            const q = data.questions[qi];
            const isFill = q.type === "fill";
            const answerText = isFill
              ? q.answer
              : `${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}`;
            const stem = (q.stem ?? "").replace(/\n/g, " ");
            return (
              <div
                key={`${q.id}-${qi}`}
                style={{
                  borderRadius: 22,
                  border: `2px solid ${colors.glassBorder}`,
                  backgroundColor: colors.glass,
                  padding: "24px 28px",
                }}
              >
                {/* 题号 + 题干 */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <span
                    style={{
                      flexShrink: 0,
                      width: 52,
                      height: 52,
                      borderRadius: 999,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: fonts.number,
                      fontSize: 30,
                      fontWeight: 700,
                      color: "#FFFFFF",
                      backgroundColor: colors.gold,
                      marginTop: 4,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: fonts.serif,
                      fontSize: stemFontSize(stem),
                      fontWeight: 700,
                      lineHeight: 1.5,
                      color: colors.light,
                    }}
                  >
                    {stem}
                  </span>
                </div>
                {/* 答案 */}
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 26,
                      letterSpacing: 2,
                      color: colors.muted,
                    }}
                  >
                    答案
                  </span>
                  <span
                    style={{
                      fontFamily: fonts.serif,
                      fontSize: 40,
                      fontWeight: 800,
                      letterSpacing: 2,
                      color: colors.jade,
                    }}
                  >
                    {answerText}
                  </span>
                </div>
                {/* 解释 */}
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: fonts.sans,
                    fontSize: 31,
                    lineHeight: 1.6,
                    color: colors.ink,
                    opacity: 0.88,
                  }}
                >
                  {q.explanation ?? ""}
                </div>
              </div>
            );
          })}
        </div>

        {/* 页脚：CTA + 落款 */}
        <div
          style={{
            flexShrink: 0,
            paddingTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 34,
              fontWeight: 700,
              letterSpacing: 3,
              color: colors.vermilion,
            }}
          >
            {data.outro?.cta ?? "点赞 · 收藏 · 关注"}
          </span>
          <span
            style={{
              fontFamily: fonts.kai,
              fontSize: 26,
              letterSpacing: 3,
              color: colors.muted,
            }}
          >
            {data.meta.hostTag}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
