import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { THEME } from "../theme";
import { BurstChrome } from "../components/BurstChrome";
import { computeAnswerPages } from "../answerSheet";
import type {
  ChoiceQuestion,
  FillQuestion,
  QuestionSlot,
  QuizData,
} from "../types";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** 答案回顾每页可用高度（1920 - 顶部标题区 ~400 - 底部常驻条 ~170） */
const SUMMARY_AVAILABLE = 1350;
/** 老年观众大字标准：题干/解释字号与正片对齐（正片题干 56-66、解释 38） */
const SUMMARY_STEM = 50;
const SUMMARY_EXPLAIN = 36;

/** 答案行文案（与字幕/答案图一致） */
const answerOf = (slot: QuestionSlot): string => {
  if (slot.kind === "fill") {
    return (slot.question as FillQuestion).answer;
  }
  const q = slot.question as ChoiceQuestion;
  return `${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}`;
};

/**
 * 片尾「本期答案」回顾（快闪模板专属，仅画面、不进字幕）：
 * 按估算高度自动分页（每页 2~4 题），页间淡入淡出；
 * 卡片排版与答案解释图一致：题号徽章 + 题干 + 答案 + 解释，行数受控不溢出。
 */
export const SummaryScene: React.FC<{
  slots: QuestionSlot[];
  meta: QuizData["meta"];
  badge: string;
  saveText?: string;
  disclaimer?: string;
  durationInFrames: number;
}> = ({ slots, meta, badge, saveText, disclaimer, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { colors, fonts, layout } = THEME;

  const questions = slots.map((s) => s.question);
  const pages = computeAnswerPages(
    questions,
    SUMMARY_AVAILABLE,
    SUMMARY_STEM,
    SUMMARY_EXPLAIN
  );
  const pageFrames = durationInFrames / pages.length;
  const pageIndex = Math.min(
    Math.floor(frame / pageFrames),
    pages.length - 1
  );
  const local = frame - pageIndex * pageFrames;
  const page = pages[pageIndex];

  // 页间过渡：每页开头 6 帧淡入、结尾 6 帧淡出（快闪节奏，切页利落）
  const pageIn = interpolate(local, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pageOut = interpolate(local, [pageFrames - 6, pageFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: pageIn * pageOut }}>
      <BurstChrome
        series={meta.series}
        badge={badge}
        saveText={saveText}
        disclaimer={disclaimer}
      />

      {/* 页头：标题 + 页码 */}
      <div
        style={{
          position: "absolute",
          top: 210,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <span
          style={{
            fontFamily: fonts.serif,
            fontSize: 80,
            fontWeight: 800,
            letterSpacing: 8,
            color: colors.light,
          }}
        >
          本期答案
        </span>
        <div
          style={{
            width: 260,
            height: 3,
            background:
              "linear-gradient(90deg, rgba(229,185,107,0), rgba(229,185,107,0.9), rgba(229,185,107,0))",
          }}
        />
        {pages.length > 1 ? (
          <span
            style={{
              fontFamily: fonts.number,
              fontSize: 30,
              color: colors.muted,
              letterSpacing: 2,
            }}
          >
            {pageIndex + 1} / {pages.length}
          </span>
        ) : null}
      </div>

      {/* 逐题卡片（当前页，行数受控不溢出） */}
      <div
        style={{
          position: "absolute",
          top: 420,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {page.indices.map((qi, idx) => {
          const slot = slots[qi];
          const q = slot.question;
          const isFill = slot.kind === "fill";
          const answerText = isFill
            ? (q as FillQuestion).answer
            : `${LETTERS[(q as ChoiceQuestion).answerIndex]}. ${
                (q as ChoiceQuestion).options[(q as ChoiceQuestion).answerIndex]
              }`;
          const stem = (q.stem ?? "").replace(/\n/g, " ");
          // 页内逐卡入场（错峰 4 帧）
          const cardIn = interpolate(local, [idx * 4 + 2, idx * 4 + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={q.id}
              style={{
                opacity: cardIn,
                borderRadius: 20,
                border: `2px solid ${colors.glassBorder}`,
                backgroundColor: colors.glass,
                padding: "20px 26px",
              }}
            >
              {/* 题号 + 题干（最多 2 行） */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: fonts.number,
                    fontSize: 32,
                    fontWeight: 700,
                    color: "#FFFFFF",
                    backgroundColor: colors.gold,
                    marginTop: 4,
                  }}
                >
                  {qi + 1}
                </span>
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: SUMMARY_STEM,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    color: colors.light,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {stem}
                </span>
              </div>
              {/* 答案 */}
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 30,
                    letterSpacing: 2,
                    color: colors.muted,
                  }}
                >
                  答案
                </span>
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 50,
                    fontWeight: 800,
                    letterSpacing: 1,
                    color: colors.jade,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {answerText}
                </span>
              </div>
              {/* 解释（最多 3 行） */}
              <div
                style={{
                  marginTop: 6,
                  fontFamily: fonts.sans,
                  fontSize: SUMMARY_EXPLAIN,
                  lineHeight: 1.5,
                  color: colors.ink,
                  opacity: 0.86,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {q.explanation ?? ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部提示（MIN_PAGE_SECONDS 保底说明页切换节奏） */}
      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom - 20,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: fonts.sans,
          fontSize: 32,
          letterSpacing: 4,
          color: colors.muted,
          opacity: interpolate(
            frame,
            [durationInFrames - 30, durationInFrames - 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          ),
        }}
      >
        记得截图保存 · 评论区对答案
      </div>
    </AbsoluteFill>
  );
};
