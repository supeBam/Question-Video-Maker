import React from "react";
import { THEME } from "../theme";

export type HeaderProps = {
  /** 左侧栏目名，如「中国文学常识」 */
  series: string;
  /** 期号，如「第 01 期」 */
  episodeLabel: string;
  /** 右侧计数，如「1 / 4」，不传则隐藏 */
  counter?: string;
  opacity?: number;
};

/** 顶部信息条：栏目名 · 期号 ｜ 题号计数 */
export const Header: React.FC<HeaderProps> = ({
  series,
  episodeLabel,
  counter,
  opacity = 1,
}) => {
  const { colors, fonts, fontSize, layout } = THEME;

  return (
    <div
      style={{
        position: "absolute",
        top: layout.safeTop,
        left: layout.sideMargin,
        right: layout.sideMargin,
        height: 66,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        opacity,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 8,
            height: 34,
            borderRadius: 4,
            backgroundColor: colors.vermilion,
          }}
        />
        <span
          style={{
            fontFamily: fonts.serif,
            fontSize: fontSize.header,
            color: colors.light,
            letterSpacing: 4,
            fontWeight: 600,
          }}
        >
          {series}
        </span>
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: fontSize.header - 4,
            color: colors.muted,
            letterSpacing: 2,
          }}
        >
          {episodeLabel}
        </span>
      </div>

      {counter ? (
        <span
          style={{
            fontFamily: fonts.number,
            fontSize: fontSize.header + 6,
            color: colors.gold,
            letterSpacing: 3,
          }}
        >
          {counter}
        </span>
      ) : null}
    </div>
  );
};
