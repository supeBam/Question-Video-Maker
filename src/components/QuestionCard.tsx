import React from "react";
import { useCurrentFrame } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp } from "../animations";

export type QuestionCardProps = {
  /** 题干，支持 \n 手动换行 */
  stem: string;
  /** 题号，从 1 开始 */
  number: number;
  /** 入场起始帧 */
  startFrame?: number;
  /** 卡片固定高度（保证每题版式一致，选项不会上下跳） */
  height?: number;
  /** 强制字号，不传则按字数自动缩放 */
  fontSize?: number;
};

/** 按题干长度自动选字号，保证长题也不溢出 */
const autoFontSize = (stem: string) => {
  const lines = stem.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const total = stem.replace(/\n/g, "").length;
  if (longest > 26 || total > 46) return 42;
  if (longest > 20 || total > 32) return THEME.fontSize.stemSmall;
  return THEME.fontSize.stem;
};

/** 宣纸质感题干卡片：左上角题号印 + 题干文字 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  stem,
  number,
  startFrame = 0,
  height = 300,
  fontSize,
}) => {
  const frame = useCurrentFrame();
  const { colors, fonts } = THEME;
  const size = fontSize ?? autoFontSize(stem);
  const anim = fadeSlideUp(frame, startFrame, 18, 30);

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: 28,
        backgroundColor: colors.paper,
        boxShadow: "0 22px 60px rgba(0,0,0,0.42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 56px 48px 56px",
        ...anim,
      }}
    >
      {/* 题号小印 */}
      <div
        style={{
          position: "absolute",
          top: -22,
          left: 40,
          width: 92,
          height: 44,
          borderRadius: 10,
          backgroundColor: colors.vermilion,
          color: colors.paper,
          fontFamily: fonts.kai,
          fontSize: 26,
          letterSpacing: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 20px rgba(196,64,46,0.35)",
        }}
      >
        第{number}题
      </div>

      {/* 四角装饰线 */}
      <div
        style={{
          position: "absolute",
          inset: 14,
          border: `2px solid ${colors.ink}1A`,
          borderRadius: 18,
        }}
      />

      <p
        style={{
          margin: 0,
          fontFamily: fonts.serif,
          fontSize: size,
          lineHeight: 1.5,
          fontWeight: 700,
          color: colors.ink,
          textAlign: "center",
          whiteSpace: "pre-line",
        }}
      >
        {stem}
      </p>
    </div>
  );
};
