/**
 * answerSheet.ts —— 「答案解释图」分页纯函数
 *
 * 用途：把一期题库的「题号 + 题干 + 答案 + 解释」排版成竖屏答案解释图
 * （放在视频结尾 / 发布配图用）。解释内容多时按估算高度自动分页，
 * 组件（AnswerSheetImage.tsx）与渲染脚本（render-with-cover.mjs）共用本函数，
 * 保证「脚本算出几页」与「组件画出第几页」完全一致。
 */

import type { AnyQuestion } from "./types";

export type AnswerPage = {
  /** 该页包含的题目下标（对应 data.questions 数组） */
  indices: number[];
};

/** 竖屏 1080×1920：顶部标题区 + 底部落款区的固定占用 */
const PAGE_TOP = 230;
const PAGE_BOTTOM = 150;
/** 题目区可用高度 */
const PAGE_AVAILABLE = 1920 - PAGE_TOP - PAGE_BOTTOM;

/** 题干字号（组件内保持一致） */
const STEM_FONT = 42;
/** 解释字号（组件内保持一致） */
const EXPLAIN_FONT = 31;
/** 题区排版宽度（安全边距内） */
const LINE_WIDTH = 880;

/** 中文近似：字号 ≈ 字宽，估算一行能放几个字 */
const charsPerLine = (fontSize: number) => Math.floor(LINE_WIDTH / fontSize);

/** 按换行拆段，估算文本行数（长句自动折行） */
const countLines = (text: string, fontSize: number) => {
  const per = Math.max(charsPerLine(fontSize), 1);
  const segments = text.split("\n");
  let total = 0;
  for (const seg of segments) {
    const len = seg.length;
    total += len === 0 ? 1 : Math.ceil(len / per);
  }
  return Math.max(total, 1);
};

/**
 * 估算单题在答案解释图上的高度（px），与组件排版口径一致：
 * 题号徽章 + 题干（多行） + 答案行 + 解释（多行） + 题间距
 * 字号可自定义（老年大字版答案回顾传更大的字号）。
 */
const estimateQuestionHeight = (
  q: AnyQuestion,
  stemFont: number = STEM_FONT,
  explainFont: number = EXPLAIN_FONT
) => {
  const stemLines = countLines(q.stem ?? "", stemFont);
  const answerText =
    q.type === "fill" ? (q.answer ?? "") : (q.options[q.answerIndex] ?? "");
  const explainLines = countLines(q.explanation ?? "", explainFont);
  return (
    stemLines * Math.round(stemFont * 1.55) + // 题干（含徽章行高）
    Math.round(explainFont * 2) + // 答案行
    explainLines * Math.round(explainFont * 1.6) + // 解释
    56 + // 题间距 + 卡片 padding
    10
  );
};

/**
 * 贪心分页：按估算高度累加，超过可用高度就开新页；
 * 保证任何一页都不溢出安全区。页数 = 返回数组长度。
 * availableHeight / 字号可自定义（答案回顾场景用大字号、略矮的排版区）。
 */
export const computeAnswerPages = (
  questions: AnyQuestion[],
  availableHeight: number = PAGE_AVAILABLE,
  stemFont: number = STEM_FONT,
  explainFont: number = EXPLAIN_FONT
): AnswerPage[] => {
  const pages: AnswerPage[] = [];
  let current: number[] = [];
  let used = 0;

  for (let i = 0; i < questions.length; i++) {
    const h = estimateQuestionHeight(questions[i], stemFont, explainFont);
    if (current.length > 0 && used + h > availableHeight) {
      pages.push({ indices: current });
      current = [];
      used = 0;
    }
    current.push(i);
    used += h;
  }
  if (current.length > 0) pages.push({ indices: current });
  return pages;
};
