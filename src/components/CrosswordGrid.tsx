import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { THEME } from "../theme";
import { fadeSlideUp } from "../animations";
import { buildGrid } from "../crossword";
import type { CrosswordClue } from "../types";

export type CrosswordGridProps = {
  clues: CrosswordClue[];
  /** 是否已揭晓（true 时留白处补入答案字并高亮） */
  revealed: boolean;
  /** 入场起始帧 */
  startFrame?: number;
  /** 方格最大边长，用于限制超大网格 */
  maxCellSize?: number;
  /** 可用高度预算（像素），用于自适应缩放 */
  availableHeight?: number;
};

/** 线索起点的小序号角标 */
const StartBadge: React.FC<{ num: number; size: number }> = ({ num, size }) => (
  <div
    style={{
      position: "absolute",
      top: 3,
      left: 4,
      fontFamily: THEME.fonts.number,
      fontSize: Math.max(11, size * 0.2),
      fontWeight: 700,
      color: THEME.colors.goldDim,
      lineHeight: 1,
    }}
  >
    {num}
  </div>
);

/**
 * 诗词填字纵横网格（规范填字样式）：
 *   - 不在任何线索上的格为透明「空洞」
 *   - 已给出的字：墨色 +（若是线索起点）金色小序号
 *   - 留白格（未揭晓）：轻边框空槽 +（若是线索起点）金色小序号
 *   - 留白格（已揭晓）：翠绿高亮 + 答案字弹性弹入
 * 交叉点（纵横共用同一字）若被标为留白，则该格按留白处理。
 */
export const CrosswordGrid: React.FC<CrosswordGridProps> = ({
  clues,
  revealed,
  startFrame = 0,
  maxCellSize = 58,
  availableHeight = 700,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts, layout } = THEME;

  const grid = buildGrid(clues);
  const gap = 5;
  // 容器内边距：网格四周留白（宣纸面板）。必须计入尺寸预算，否则盒子会超出可用区。
  const pad = 28;
  const maxW = layout.width - 2 * layout.sideMargin - 16;
  // 减去内边距后，才是真正可用于方格的区域
  const innerW = maxW - 2 * pad;
  const innerH = availableHeight - 2 * pad;
  const cellSize = Math.max(
    28,
    Math.min(
      maxCellSize,
      Math.floor((innerW - (grid.cols - 1) * gap) / grid.cols),
      Math.floor((innerH - (grid.rows - 1) * gap) / grid.rows)
    )
  );

  const gridWidth = grid.cols * cellSize + (grid.cols - 1) * gap;
  const gridHeight = grid.rows * cellSize + (grid.rows - 1) * gap;
  // 盒子（含内边距）实际占地，且夹紧在可用宽/高内，确保不超出框
  const outerW = Math.min(maxW, gridWidth + 2 * pad);
  const outerH = Math.min(availableHeight, gridHeight + 2 * pad);

  return (
    <div
      style={{
        boxSizing: "border-box",
        width: outerW,
        height: outerH,
        display: "grid",
        gridTemplateColumns: `repeat(${grid.cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${grid.rows}, ${cellSize}px)`,
        gap: `${gap}px`,
        alignSelf: "center",
        backgroundColor: colors.paper,
        borderRadius: 24,
        padding: pad,
        boxShadow: "0 12px 32px rgba(46,36,24,0.16)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 10,
          border: `2px solid ${colors.ink}1A`,
          borderRadius: 16,
          pointerEvents: "none",
        }}
      />

      {grid.cells.map((cell, order) => {
        if (cell.block) {
          return (
            <div
              key={order}
              style={{ width: cellSize, height: cellSize }}
              aria-hidden
            />
          );
        }

        const enter = fadeSlideUp(frame, startFrame + order * 1.2, 14, 12);
        const badge = cell.startNum ? (
          <StartBadge num={cell.startNum} size={cellSize} />
        ) : null;

        // 揭晓 + 留白 → 翠绿高亮 + 答案字弹入
        if (revealed && cell.isBlank) {
          const pop = spring({
            frame: frame - startFrame - 6,
            fps,
            config: { damping: 12, stiffness: 180, mass: 0.6 },
          });
          const fillT = interpolate(
            frame,
            [startFrame + 6, startFrame + 26],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          return (
            <div
              key={order}
              style={{
                position: "relative",
                width: cellSize,
                height: cellSize,
                borderRadius: 10,
                border: `3px solid ${colors.jade}`,
                backgroundColor: "rgba(67,176,124,0.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 ${26 * fillT}px rgba(67,176,124,${0.5 * fillT})`,
                ...enter,
              }}
            >
              {badge}
              <span
                style={{
                  fontFamily: fonts.serif,
                  fontSize: cellSize * 0.56,
                  fontWeight: 700,
                  color: "#0E3B2A",
                  transform: `scale(${0.5 + 0.5 * pop})`,
                  opacity: pop,
                }}
              >
                {cell.char}
              </span>
            </div>
          );
        }

        // 未揭晓 + 留白 → 轻边框空槽（待填）
        if (cell.isBlank) {
          return (
            <div
              key={order}
              style={{
                position: "relative",
                width: cellSize,
                height: cellSize,
                borderRadius: 10,
                border: `1px solid rgba(23,34,44,0.28)`,
                backgroundColor: "rgba(23,34,44,0.04)",
                ...enter,
              }}
            >
              {badge}
            </div>
          );
        }

        // 已给出的字（墨色，起点带序号）
        const isIntersection = Boolean(cell.across && cell.down);
        return (
          <div
            key={order}
            style={{
              position: "relative",
              width: cellSize,
              height: cellSize,
              borderRadius: 10,
              border: `1px solid rgba(23,34,44,0.22)`,
              backgroundColor: isIntersection
                ? "rgba(229,185,107,0.16)"
                : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...enter,
            }}
          >
            {badge}
            <span
              style={{
                fontFamily: fonts.serif,
                fontSize: cellSize * 0.56,
                fontWeight: 700,
                color: colors.ink,
              }}
            >
              {cell.char}
            </span>
          </div>
        );
      })}
    </div>
  );
};
