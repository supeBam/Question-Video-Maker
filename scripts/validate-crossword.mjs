import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = process.argv[2];
const data = JSON.parse(fs.readFileSync(p, "utf-8"));
const cw = data.questions.find((q) => q.type === "crossword");
const clues = cw.clues;

// 包围盒
let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
const cellChar = new Map();
const cellClues = new Map();
let conflicts = 0;

for (const c of clues) {
  for (let i = 0; i < c.text.length; i++) {
    const r = c.dir === "down" ? c.row + i : c.row;
    const col = c.dir === "across" ? c.col + i : c.col;
    minR = Math.min(minR, r); minC = Math.min(minC, col);
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, col);
    const key = `${r},${col}`;
    if (cellChar.has(key) && cellChar.get(key) !== c.text[i]) {
      console.log(`✗ 冲突 @(${r},${col}): "${cellChar.get(key)}" vs "${c.text[i]}" (clue ${cellClues.get(key)} & ${c.id})`);
      conflicts++;
    }
    cellChar.set(key, c.text[i]);
    cellClues.set(key, c.id);
  }
}

const rows = maxR - minR + 1, cols = maxC - minC + 1;
let blankCount = 0;
const blankList = [];
for (const c of clues) {
  for (const bi of (c.blanks ?? [])) {
    const r = c.dir === "down" ? c.row + bi : c.row;
    const col = c.dir === "across" ? c.col + bi : c.col;
    blankCount++;
    blankList.push({ clue: c.id, char: c.text[bi], at: `(${r},${col})` });
  }
}

// 交叉点（被两条线索共用的格子）
const intersections = [...cellClues.entries()];
console.log(`网格尺寸：行 ${rows} × 列 ${cols}`);
console.log(`线索数：${clues.length}，留白数：${blankCount}`);
console.log("留白清单：", blankList.map((b) => `${b.clue}:${b.char}`).join(" "));
console.log(conflicts === 0 ? "✓ 所有交叉点字符一致，无冲突" : `✗ 发现 ${conflicts} 处冲突`);

// 连通性检查：所有已填格必须正交相连成一个整体（否则看起来像多道题）
const occupied = [...cellChar.keys()];
const seen = new Set();
let components = 0;
for (const start of occupied) {
  if (seen.has(start)) continue;
  components++;
  const stack = [start];
  seen.add(start);
  while (stack.length) {
    const [r, c] = stack.pop().split(",").map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${r + dr},${c + dc}`;
      if (cellChar.has(nk) && !seen.has(nk)) {
        seen.add(nk);
        stack.push(nk);
      }
    }
  }
}
if (components > 1) {
  console.log(`⚠ 网格被拆成 ${components} 个互不相连的部分（看起来像多道题），请调整摆位让它们连成一张网`);
} else {
  console.log("✓ 全部线索正交相连，是同一张连通的纵横网（只有一道题）");
}
process.exit(conflicts === 0 && components === 1 ? 0 : 1);
