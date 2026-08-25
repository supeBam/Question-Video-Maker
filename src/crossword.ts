/* ============================================================
 * 诗词填字纵横 · 网格构建（纯函数）
 * 把一组「横/纵」线索推导成可渲染的网格：
 *   - 自动计算网格尺寸（按线索占据的行列包围盒）
 *   - 每个格子记录字符、是否留白、横向/纵向归属（交叉点同时归属两向）
 *   - 交叉点字符不一致时控制台告警（作者摆位错误）
 *   - 每条线索的「起点格」按阅读顺序编号（横 1.. / 纵 1..），用于规范填字样式
 * ============================================================ */

import type { CrosswordClue } from "./types";

export type GridCell = {
  /** 归一化后的行号（从 0 开始） */
  row: number;
  /** 归一化后的列号（从 0 开始） */
  col: number;
  /** 该格的正确字（交叉点取首个写入的字） */
  char: string;
  /** 是否留白待填 */
  isBlank: boolean;
  /** 经过此格的横向线索 id（无则缺省） */
  across?: string;
  /** 经过此格的纵向线索 id（无则缺省） */
  down?: string;
  /** 是否不在任何线索上（背景空格） */
  block: boolean;
  /** 若该格是某条线索的起点，记录其线索编号 */
  startNum?: number;
};

export type NumberedBlank = {
  row: number;
  col: number;
  char: string;
  num: number;
};

export type ClueNumber = {
  id: string;
  dir: "across" | "down";
  num: number;
  row: number;
  col: number;
};

export type CrosswordGrid = {
  rows: number;
  cols: number;
  cells: GridCell[];
  blanks: NumberedBlank[];
  /** 线索编号（横、纵各自从 1 开始，按起点阅读顺序） */
  clueOrder: ClueNumber[];
};

const norm = (clue: CrosswordClue) =>
  clue.text
    .split("")
    .map((ch, i) => ({
      ch,
      r: clue.dir === "down" ? clue.row + i : clue.row,
      c: clue.dir === "across" ? clue.col + i : clue.col,
      blank: (clue.blanks ?? []).includes(i),
    }));

export const buildGrid = (clues: CrosswordClue[]): CrosswordGrid => {
  // 1. 求包围盒
  let minR = Infinity;
  let minC = Infinity;
  let maxR = -Infinity;
  let maxC = -Infinity;

  clues.forEach((c) =>
    norm(c).forEach(({ r, c: col }) => {
      minR = Math.min(minR, r);
      minC = Math.min(minC, col);
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, col);
    })
  );

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  const cells: GridCell[] = Array.from({ length: rows * cols }, () => ({
    row: 0,
    col: 0,
    char: "",
    isBlank: false,
    block: true,
  }));

  const at = (r: number, c: number) => cells[(r - minR) * cols + (c - minC)];

  // 2. 填入每条线索
  clues.forEach((c) => {
    norm(c).forEach(({ ch, r, c: col, blank }) => {
      const cell = at(r, col);
      if (!cell.block && cell.char && cell.char !== ch) {
        if (typeof console !== "undefined") {
          console.warn(
            `[crossword] 交叉点字符不一致 @(raw ${r},${col})：已有「${cell.char}」与「${ch}」冲突`
          );
        }
      }
      cell.block = false;
      cell.char = ch;
      cell.isBlank = cell.isBlank || blank;
      if (c.dir === "across") cell.across = c.id;
      else cell.down = c.id;
      cell.row = r - minR;
      cell.col = col - minC;
    });
  });

  // 3. 线索起点编号（横、纵各自 1..，按起点阅读顺序）
  const starts = clues
    .map((c) => ({
      id: c.id,
      dir: c.dir,
      r: c.dir === "down" ? c.row : c.row,
      c: c.dir === "across" ? c.col : c.col,
    }))
    .map((s) => ({ ...s, nr: s.r - minR, nc: s.c - minC }))
    .sort((a, b) => a.nr - b.nr || a.nc - b.nc);

  const clueOrder: ClueNumber[] = [];
  let acNum = 0;
  let dnNum = 0;
  starts.forEach((s) => {
    const num = s.dir === "across" ? ++acNum : ++dnNum;
    const cell = at(s.r, s.c);
    cell.startNum = num;
    clueOrder.push({ id: s.id, dir: s.dir, num, row: s.nr, col: s.nc });
  });

  // 4. 留白（用于动画/统计，不再逐格标大号）
  const blanks: NumberedBlank[] = cells
    .filter((cell) => cell.isBlank)
    .map((cell) => ({ row: cell.row, col: cell.col, char: cell.char, num: 0 }));

  return { rows, cols, cells, blanks, clueOrder };
};

/** 取某格（归一化坐标） */
export const getCell = (grid: CrosswordGrid, row: number, col: number) =>
  grid.cells[row * grid.cols + col];
