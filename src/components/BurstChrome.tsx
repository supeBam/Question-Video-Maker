import React from "react";
import { THEME } from "../theme";

export type BurstChromeProps = {
  /** 顶部左侧挑战式栏目名，如「雅称挑战」 */
  series: string;
  /** 顶部右侧激励角标，如「全对 = 学霸」 */
  badge: string;
  /** 题号计数，如「3 / 6」 */
  counter?: string;
  /** 底部收藏指令，如「❤ 收藏 · 考考孩子」 */
  saveText?: string;
  /** 底部免责声明，如「内容来源于公开资料」 */
  disclaimer?: string;
};

/**
 * 爆款快闪模板常驻框架（对标「学霸都考哭了」系列）：
 *  顶部：栏目名 + 「全对 = 学霸」激励角标 + 题号计数（全程不换，形成系列感）
 *  底部：收藏指令 + 免责声明（对标②的常驻合规话术）
 */
export const BurstChrome: React.FC<BurstChromeProps> = ({
  series,
  badge,
  counter,
  saveText,
  disclaimer,
}) => {
  const { colors, fonts, fontSize, layout } = THEME;

  return (
    <>
      {/* 顶部：栏目名 ｜ 激励角标 + 计数 */}
      <div
        style={{
          position: "absolute",
          top: layout.safeTop,
          left: layout.sideMargin,
          right: layout.sideMargin,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
              fontSize: fontSize.header + 6,
              color: colors.light,
              letterSpacing: 4,
              fontWeight: 700,
            }}
          >
            {series}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {counter ? (
            <span
              style={{
                fontFamily: fonts.number,
                fontSize: fontSize.header + 8,
                color: colors.gold,
                letterSpacing: 2,
              }}
            >
              {counter}
            </span>
          ) : null}
          <div
            style={{
              padding: "10px 26px",
              borderRadius: 999,
              background:
                "linear-gradient(100deg, rgba(229,185,107,0.95), rgba(201,162,90,0.95))",
              boxShadow: "0 8px 24px rgba(229,185,107,0.3)",
              fontFamily: fonts.sans,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: 3,
              color: "#20160A",
            }}
          >
            {badge}
          </div>
        </div>
      </div>

      {/* 底部：收藏指令 + 免责声明 */}
      <div
        style={{
          position: "absolute",
          bottom: layout.safeBottom - 66,
          left: layout.sideMargin,
          right: layout.sideMargin,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {saveText ? (
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 30,
              letterSpacing: 2,
              color: colors.vermilion,
              fontWeight: 600,
            }}
          >
            {saveText}
          </span>
        ) : (
          <span />
        )}
        {disclaimer ? (
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 26,
              letterSpacing: 1,
              color: colors.muted,
              opacity: 0.72,
            }}
          >
            {disclaimer}
          </span>
        ) : null}
      </div>
    </>
  );
};
