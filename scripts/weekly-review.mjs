#!/usr/bin/env node
/**
 * weekly-review.mjs —— 周复盘一键脚本
 *
 * 把周复盘要做的杂事串成一条命令：
 *   ① 更新发布台账（复用 build-ledger.mjs 的 runLedger：Excel/CSV → 期号识别 → 台账登记）
 *   ② 清理 out/ 调试垃圾（保留成片与未识别清单）
 *   ③ 输出本周复盘摘要（台账规模 / 新增 / 未识别 / 平台分布 / 清理结果）
 *
 * 用法：
 *   node scripts/weekly-review.mjs --wechat=导入/视频号/…csv --douyin=导入/抖音/…xlsx
 *   可选：--no-clean 跳过 out/ 清理；--out=… 指定台账路径（默认 docs/发布台账.md）
 *   多个同平台文件用逗号分隔。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runLedger } from "./build-ledger.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const parseArgs = () => {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (a === "--no-clean") args.noClean = true;
  }
  return args;
};

// ── ② out/ 清理（只删可再生调试垃圾，绝不碰成片与未识别清单） ──

const CLEANUP_PATTERNS = [
  /^\.remotion-props-.*\.json$/, // 渲染临时 props 残留
  /^burst-preview-.*\.png$/, // 快闪模板预览调试
  /^burst-choice-.*\.png$/, // 快闪选择题调试
  /^check-.*\.png$/, // 模板画面检查
];

const KEEP_PATTERNS = [
  /^ledger-unmatched-.*\.txt$/, // 未识别清单（处理完再删）
  /\.(mp4|png|srt|txt)$/, // 成套成片（视频/封面/字幕/发布文案）
];

/** 返回 { deleted: string[], kept: string[] }；stills/ 目录整体清空 */
const cleanOut = (outDir) => {
  const deleted = [];
  const kept = [];
  if (!fs.existsSync(outDir)) return { deleted, kept };
  for (const f of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (f.isDirectory()) {
      if (f.name === "stills") {
        const stillsDir = path.join(outDir, f.name);
        for (const s of fs.readdirSync(stillsDir)) {
          fs.rmSync(path.join(stillsDir, s), { force: true });
          deleted.push(`stills/${s}`);
        }
      } else {
        kept.push(`${f.name}/（未知目录，不动）`);
      }
      continue;
    }
    if (CLEANUP_PATTERNS.some((re) => re.test(f.name))) {
      fs.rmSync(path.join(outDir, f.name), { force: true });
      deleted.push(f.name);
    } else if (KEEP_PATTERNS.some((re) => re.test(f.name))) {
      kept.push(f.name);
    } else {
      kept.push(`${f.name}（未知文件，不动）`);
    }
  }
  return { deleted, kept };
};

// ── ③ 周复盘摘要 ──

const pad = (n) => String(n).padStart(2, "0");

const summarize = (ledger, cleanResult, noClean) => {
  console.log("\n===== 本周复盘摘要 =====");
  console.log(`📋 发布台账：共 ${ledger.total} 行（本次新增 ${ledger.added.length} 行）→ ${ledger.ledgerPath}`);
  if (ledger.added.length > 0) {
    const byPlatform = ledger.added.reduce((acc, a) => {
      acc[a.platform] = (acc[a.platform] || 0) + 1;
      return acc;
    }, {});
    console.log(`   新增分布：${Object.entries(byPlatform).map(([p, n]) => `${p} ${n} 条`).join("、")}`);
  }
  if (ledger.unmatched.length > 0) {
    console.log(`⚠️  未识别 ${ledger.unmatched.length} 条（见 ${ledger.unmatchedPath}）：`);
    for (const u of ledger.unmatched) console.log(`   ? ${u.date || "?"} ${u.platform} ${u.title.slice(0, 40)}`);
    console.log(`   → 请人工确认后补登台账，未确认前不计入分析。`);
  }
  if (noClean) {
    console.log(`🧹 out/ 清理：已跳过（--no-clean）`);
  } else {
    console.log(`🧹 out/ 清理：删除 ${cleanResult.deleted.length} 个调试文件`);
    for (const d of cleanResult.deleted) console.log(`   - ${d}`);
    console.log(`   保留 ${cleanResult.kept.length} 项（成片与清单）：`);
    for (const k of cleanResult.kept) console.log(`   · ${k}`);
  }
  console.log(`\n✅ 周复盘台账整理完成。下一步：处理未识别清单 → 按平台导入 Excel 做题型 × 平台分析。`);
};

// ── main ──────────────────────────────────────────────────

const main = () => {
  const args = parseArgs();
  const wechatFiles = (args.wechat || "").split(",").filter(Boolean);
  const douyinFiles = (args.douyin || "").split(",").filter(Boolean);
  if (wechatFiles.length === 0 && douyinFiles.length === 0) {
    console.error("用法：node scripts/weekly-review.mjs --wechat=导入/视频号/…csv --douyin=导入/抖音/…xlsx [--no-clean] [--out=docs/发布台账.md]");
    process.exit(1);
  }

  console.log("== 周复盘一键整理 ==");
  const ledger = runLedger({ wechat: wechatFiles, douyin: douyinFiles, out: args.out });

  const outDir = path.join(ROOT, "out");
  const cleanResult = args.noClean ? { deleted: [], kept: [] } : cleanOut(outDir);

  summarize(ledger, cleanResult, Boolean(args.noClean));
};

main();
