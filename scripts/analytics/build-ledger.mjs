#!/usr/bin/env node
/**
 * build-ledger.mjs —— 周复盘自动整理：Excel/CSV 视频数据 ↔ 题库期号 对照 → 更新发布台账
 *
 * 用途：
 *   1. 扫描 src/data/ 全部题库，建立「期号 ↔ JSON ↔ 标题关键词」索引；
 *   2. 读用户周复盘导入的平台数据（视频号 CSV 直读；抖音 xlsx 用本机 Excel COM 转 CSV）；
 *   3. 按「发布日期 + 标题」自动识别期号（优先级：期号关键词 → 系列关键词 → 标题片段 + 日期窗口）；
 *   4. 把识别出的发布记录合并进 docs/发布台账.md（按日期倒序，去重，删除模板示例行）；
 *   5. 识别不出的行输出「未识别清单」到 out/，绝不猜测。
 *
 * 用法：
 *   node scripts/build-ledger.mjs --wechat=路径.csv [--douyin=路径.xlsx或csv] [--data=src/data] [--out=docs/发布台账.md]
 *   多个同平台文件用逗号分隔。
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ── 参数 ───────────────────────────────────────────────────

const parseArgs = () => {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
};

// ── 工具 ───────────────────────────────────────────────────

const pad = (n, w = 2) => String(n).padStart(w, "0");

/** 2026/08/28、2026-08-28、2026-08-28 19:00 → { date: "2026-08-28", time: "19:00" | null } */
const normalizeDateTime = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?/);
  if (!m) return null;
  return {
    date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`,
    time: m[4] ? `${pad(m[4])}:${pad(m[5])}` : null,
  };
};

/** 简单 CSV 解析：支持引号包裹的逗号与换行（视频描述里带 \n 和 #话题） */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
};

/** 按表头模糊识别列：标题列（视频描述/作品标题/作品名称…）、时间列（发布时间/发布日期…） */
const detectColumns = (headerRow) => {
  let titleIdx = -1;
  let dateIdx = -1;
  headerRow.forEach((h, i) => {
    const hh = String(h).trim();
    if (/标题|描述|内容|名称/.test(hh) && titleIdx === -1) titleIdx = i;
    if (/发布|时间|日期/.test(hh) && dateIdx === -1) dateIdx = i;
  });
  if (titleIdx === -1 || dateIdx === -1) {
    throw new Error(`表头无法识别（title=${titleIdx}, date=${dateIdx}）：${headerRow.join(" | ")}`);
  }
  return { titleIdx, dateIdx };
};

/** 标题清理：取第一行、去 #话题标签、去空白 */
const cleanTitle = (raw) => {
  if (!raw) return "";
  return String(raw)
    .split("\n")
    .map((l) => l.replace(/#\S+/g, "").trim())
    .filter(Boolean)
    .join(" ");
};

/** 抖音 xlsx → 临时 CSV（调用本机 Excel COM；失败时给出提示） */
const xlsxToCsv = (xlsxPath) => {
  const tmp = path.join(os.tmpdir(), `ledger-${path.basename(xlsxPath, ".xlsx")}-${Date.now()}.csv`);
  // 62 = xlCSVUTF8（Excel 2016+）；旧版 Excel（如 2007）不支持，降级 6 = xlCSV(ANSI) 后按 GBK 解码
  const saveFormats = [62, 6];
  let lastErr = "";
  for (const fmt of saveFormats) {
    fs.rmSync(tmp, { force: true });
    const script = [
      `$ErrorActionPreference = 'Stop'`,
      `$excel = New-Object -ComObject Excel.Application`,
      `$excel.Visible = $false`,
      `$excel.DisplayAlerts = $false`,
      `$wb = $excel.Workbooks.Open('${xlsxPath.replace(/'/g, "''")}')`,
      `$ws = $wb.Worksheets.Item(1)`,
      `$wb.SaveAs('${tmp.replace(/'/g, "''")}', ${fmt})`,
      `$wb.Close($false)`,
      `$excel.Quit()`,
    ].join("; ");
    const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      timeout: 120_000,
    });
    if (!r.error && r.status === 0 && fs.existsSync(tmp)) {
      // UTF8 解码失败（乱码）时按 GBK 兜底
      const buf = fs.readFileSync(tmp);
      let text = buf.toString("utf8");
      if (text.includes("\uFFFD")) {
        try {
          text = new TextDecoder("gbk").decode(buf);
        } catch {
          text = buf.toString("utf8");
        }
      }
      fs.rmSync(tmp, { force: true });
      return text;
    }
    lastErr = `${r.stderr || r.stdout || ""}`.slice(0, 300);
  }
  throw new Error(
    `xlsx 转 CSV 失败（需本机安装 Excel 桌面版；已尝试 UTF8/ANSI 两种格式）：${xlsxPath}\n` +
      `请手动转换后重跑，或把抖音数据导出为 CSV 再传入。\n${lastErr}`
  );
};

/** 读取 CSV 文本并去掉 BOM */
const readCsvText = (filePath) => {
  const text = fs.readFileSync(filePath, "utf8");
  return text.replace(/^\uFEFF/, "");
};

// ── 题库索引 ───────────────────────────────────────────────

const SERIES_CORE_RULES = [
  [/万物雅称/, "雅称"],
  [/词语代称/, "代称"],
  [/中国诗词填字/, "填字"],
  [/成语/, "成语"],
  [/中国文化冷知识/, "冷知识"],
  [/中国历史冷知识/, "历史冷知识"],
  [/中国文学常识/, "文学常识"],
  [/中国朝代历史/, "朝代"],
  [/中国文学名句/, "名句"],
];

const seriesCore = (series) => {
  for (const [re, core] of SERIES_CORE_RULES) if (re.test(series)) return core;
  return series;
};

/** 扫描题库目录：常规 questions-YYMMDD[-N].json + 固定文件（questions.json 等） */
const loadQuizzes = (dataDir) => {
  const quizzes = [];
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json") && /questions/i.test(f));
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
    } catch (e) {
      console.warn(`⚠ 跳过无法解析的题库文件：${file}（${e.message}）`);
      continue;
    }
    const meta = data.meta || {};
    const pub = data.publish || {};
    const intro = data.intro || {};
    const m = file.match(/questions-(\d{6})/);
    quizzes.push({
      file,
      series: meta.series || "",
      episode: meta.episode ?? null,
      label: meta.episodeLabel || `第 ${meta.episode} 期`,
      dateStr: m ? `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}-${m[1].slice(4, 6)}` : null,
      publishTitle: pub.title || "",
      introTitle: (intro.title || "").replace(/\n/g, "，"),
      core: seriesCore(meta.series || ""),
    });
  }
  return quizzes;
};

// ── 期号匹配 ───────────────────────────────────────────────

/** 连续 ≥6 字的片段是否出现在标题中 */
const hasLongFragment = (title, source) => {
  if (!source) return false;
  const clean = source.replace(/\s+/g, "");
  for (let len = Math.min(8, clean.length); len >= 6; len--) {
    for (let i = 0; i + len <= clean.length; i++) {
      const frag = clean.slice(i, i + len);
      if (title.includes(frag)) return true;
    }
  }
  return false;
};

/**
 * 打分匹配：
 *  +100  标题含系列核心词（雅称/代称/成语/冷知识…）
 *  +100  标题与发布标题/片头标题完全互含（≥6 字）——最强证据
 *  +30   标题含「第N期」且与期数一致
 *  +40   标题含发布标题的 ≥6 字连续片段
 *  +10   发布日期在题库创作日当天或之后 3 天内
 *  ≥100 判定命中；「系列词+期号」双命中直接锁定。
 */
const matchQuiz = (title, date, quizzes) => {
  let best = null;
  for (const q of quizzes) {
    let score = 0;
    const explicitEp = title.match(/第\s*(\d+)\s*期/);
    if (q.core && title.includes(q.core)) score += 100;
    if (explicitEp && q.episode !== null && Number(explicitEp[1]) === q.episode) score += 30;
    const sources = [q.publishTitle, q.introTitle].filter(Boolean);
    const fullMatch = sources.some((s) => {
      const ss = s.replace(/\s+/g, "");
      if (ss.length < 6) return false;
      return title.includes(ss) || (title.length >= 6 && ss.includes(title));
    });
    if (fullMatch) score += 100;
    else if (hasLongFragment(title, q.publishTitle) || hasLongFragment(title, q.introTitle)) score += 40;
    if (q.dateStr && date) {
      const days = Math.round((new Date(date) - new Date(q.dateStr)) / 86_400_000);
      // 「提前剪好 + 定时发布」→ 发布日 ≥ 剪片日。若发布日早于剪片日 1 天以上，
      // 不可能是定时发布（最多是「先发后建」的 1 天跨日误差），判为误配拦截，防「仅栏目词命中」误配。
      if (days < -1) continue;
      // 定时发布：发布日 = 剪片日 +0~+1 天为常态；不设上界，避免提前多天剪片时漏分。
      if (days >= 0) score += 10;
    }
    if (score > 0 && (!best || score > best.score)) best = { quiz: q, score };
  }
  return best && best.score >= 100 ? best : null;
};

// ── 台账读写 ───────────────────────────────────────────────

const ROW_RE = /^\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/;

/** 解析台账 md：拆出「发布记录表」前的文本、表格行、表格后的文本 */
const parseLedger = (ledgerPath, templatePath) => {
  const srcPath = fs.existsSync(ledgerPath) ? ledgerPath : templatePath;
  const text = fs.readFileSync(srcPath, "utf8");
  const lines = text.split("\n");
  const tableStart = lines.findIndex((l) => l.includes("## 一、发布记录表"));
  if (tableStart === -1) throw new Error(`台账缺少「## 一、发布记录表」章节：${srcPath}`);
  const rows = [];
  let i = tableStart;
  let headerIdx = -1;
  for (; i < lines.length; i++) {
    if (/^\| 发布日期/.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error(`台账表格缺少表头：${ledgerPath}`);
  let j = headerIdx + 2; // 跳过表头与分隔行
  for (; j < lines.length; j++) {
    const l = lines[j];
    if (!l.startsWith("|")) break;
    const m = l.match(ROW_RE);
    if (!m) continue;
    const [, date, time, platform, episode, file, title] = m.map((s) => s.trim());
    if (date.includes("（示例）") || date === "发布日期") continue;
    rows.push({ date, time, platform, episode, file, title });
  }
  return {
    before: lines.slice(0, headerIdx).join("\n"),
    header: lines[headerIdx],
    rows,
    after: lines.slice(j).join("\n"),
  };
};

const formatRow = (r) =>
  `| ${r.date} | ${r.time || "—"} | ${r.platform} | ${r.episode} | ${r.file} | ${r.title} |`;

const writeLedger = (ledgerPath, parsed, rows) => {
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.time && b.time && a.time < b.time ? 1 : -1));
  const sep = `|${"-".repeat(14)}|${"-".repeat(10)}|${"-".repeat(8)}|${"-".repeat(24)}|${"-".repeat(36)}|${"-".repeat(40)}|`;
  const body = [parsed.before, parsed.header, sep, ...sorted.map(formatRow), parsed.after].join("\n");
  fs.writeFileSync(ledgerPath, body, "utf8");
  return sorted.length;
};

// ── 主流程 ─────────────────────────────────────────────────

/** 周复盘台账整理核心（可被 weekly-review.mjs 复用） */
export const runLedger = (opts = {}) => {
  const {
    wechat = [],
    douyin = [],
    data = "src/data",
    out,
  } = opts;
  const log = (...a) => console.log(...a);
  const dataDir = path.resolve(ROOT, data);
  const ledgerPath = path.resolve(ROOT, out || "docs/发布台账.md");

  log("① 扫描题库目录…");
  const quizzes = loadQuizzes(dataDir);
  log(`   索引到 ${quizzes.length} 个题库文件（${quizzes.map((q) => q.file).join("、")}）`);

  log("② 读取平台数据…");
  const entries = [];
  for (const f of wechat) {
    const p = path.resolve(ROOT, f);
    const rows = parseCsv(readCsvText(p));
    const { titleIdx, dateIdx } = detectColumns(rows[0]);
    for (const r of rows.slice(1)) {
      entries.push({ platform: "视频号", title: cleanTitle(r[titleIdx]), rawDate: r[dateIdx] });
    }
    log(`   视频号 ${f}：${rows.length - 1} 行`);
  }
  for (const f of douyin) {
    const p = path.resolve(ROOT, f);
    const text = f.toLowerCase().endsWith(".xlsx") ? xlsxToCsv(p) : readCsvText(p);
    const rows = parseCsv(text);
    const { titleIdx, dateIdx } = detectColumns(rows[0]);
    for (const r of rows.slice(1)) {
      entries.push({ platform: "抖音", title: cleanTitle(r[titleIdx]), rawDate: r[dateIdx] });
    }
    log(`   抖音 ${f}：${rows.length - 1} 行`);
  }

  log("③ 识别期号并生成台账行…");
  const defaultLedger = path.resolve(ROOT, "docs/发布台账.md");
  const parsed = parseLedger(ledgerPath, defaultLedger);
  if (!fs.existsSync(ledgerPath)) log(`   目标台账不存在，将以 ${defaultLedger} 为模板新建：${ledgerPath}`);
  const existingKeys = new Set(parsed.rows.map((r) => `${r.date}|${r.platform}|${r.episode}`));
  const added = [];
  const unmatched = [];
  for (const e of entries) {
    const dt = normalizeDateTime(e.rawDate);
    const hit = dt ? matchQuiz(e.title, dt.date, quizzes) : null;
    if (!hit) {
      unmatched.push({ platform: e.platform, date: dt ? dt.date : e.rawDate, title: e.title });
      continue;
    }
    const q = hit.quiz;
    const key = `${dt.date}|${e.platform}|${q.series} · ${q.label}`;
    if (existingKeys.has(key) || added.some((a) => a.key === key)) {
      log(`   跳过（已登记）${key}`);
      continue;
    }
    added.push({
      key,
      date: dt.date,
      time: dt.time,
      platform: e.platform,
      episode: `${q.series} · ${q.label}`,
      file: q.file,
      title: e.title,
      score: hit.score,
    });
  }

  if (added.length > 0) {
    const all = [...parsed.rows, ...added.map(({ key, ...r }) => r)];
    const total = writeLedger(ledgerPath, parsed, all);
    log(`④ 已更新 ${ledgerPath}（表格共 ${total} 行，本次新增 ${added.length} 行）：`);
    for (const a of added) log(`   + ${a.date} ${a.platform} ${a.episode} ← ${a.file}（得分 ${a.score}）`);
  } else {
    log("④ 无新增行（全部已在台账或无法识别）。");
  }

  let unmatchedPath = null;
  if (unmatched.length > 0) {
    const outDir = path.join(ROOT, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const today = new Date();
    const stamp = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;
    unmatchedPath = path.join(outDir, `ledger-unmatched-${stamp}.txt`);
    const body = unmatched.map((u) => `${u.date || "?"} | ${u.platform} | ${u.title}`).join("\n") + "\n";
    fs.writeFileSync(unmatchedPath, body, "utf8");
    log(`⚠ 未识别 ${unmatched.length} 行，已写入 ${unmatchedPath}（请人工确认后补登，勿猜测）：`);
    for (const u of unmatched.slice(0, 10)) log(`   ? ${u.date || "?"} ${u.platform} ${u.title.slice(0, 40)}`);
  }

  return { added, unmatched, unmatchedPath, total: parsed.rows.length + added.length, ledgerPath, entries };
};

const isDirectExecution = (argvPath, moduleUrl) =>
  Boolean(argvPath) && path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));

const main = () => {
  const args = parseArgs();
  const wechatFiles = (args.wechat || "").split(",").filter(Boolean);
  const douyinFiles = (args.douyin || "").split(",").filter(Boolean);
  if (wechatFiles.length === 0 && douyinFiles.length === 0) {
    console.error("用法：node scripts/build-ledger.mjs --wechat=路径.csv [--douyin=路径.xlsx] [--data=src/data] [--out=docs/发布台账.md]");
    process.exit(1);
  }
  try {
    runLedger({ wechat: wechatFiles, douyin: douyinFiles, data: args.data, out: args.out });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
};

if (isDirectExecution(process.argv[1], import.meta.url)) main();
