#!/usr/bin/env node
/**
 * deep-metrics.mjs —— 深度指标分析（门禁与统计口径由本脚本执行）
 *
 * 把描述性统计自动化，让分析师的产能全部投到归因与决策上。
 * 数据质量门禁、成熟度分组和统计口径以本脚本实现及生成报告中的定义为准。
 *
 * 输出六块：
 *   ① 数据质量门禁（B1-B7 阻断 / W1-W5 警告，含评分与等级）
 *   ② 单条明细表（成熟度 M、派生比率、相对基线倍数 R）
 *   ③ 同熟度排行（D1 / D3 / D7 分榜，跨成熟度禁止混排）
 *   ④ 增长分解（规模 / 效率 / 交叉）—— 回答"该加更还是提质量"
 *   ⑤ 题材分组检验（Bootstrap 95% CI + 置换检验 p 值）—— 解决小样本
 *   ⑥ 待补数据清单
 *
 * 用法：
 *   node scripts/analytics/deep-metrics.mjs \
 *     --wechat="docs/数据分析/导入/视频号/xxx.csv" --asof=2026-08-29 \
 *     [--prev="上期.csv" --prev-asof=2026-08-22] \
 *     [--topics=scripts/analytics/topics.json] [--dq-only] [--out=out/deep-metrics.md]
 *
 * 说明：
 *   - 抖音 xlsx 请先转 CSV 后用 --douyin 传入（与 weekly-review.mjs 同路径）
 *   - --topics 未给时跳过分组检验；未命中关键词的作品归「未分类」，不参与检验
 *   - 随机数使用固定种子（mulberry32），结果可复现
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ── 参数 ────────────────────────────────────────────────

const parseArgs = () => {
  const a = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) a[m[1]] = m[2];
    else if (arg.startsWith("--")) a[arg.slice(2)] = true;
  }
  return a;
};

// ── 工具 ────────────────────────────────────────────────

const pct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;
const num = (n, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

/** 固定种子随机数，保证可复现 */
const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const median = (xs) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const quantile = (xs, q) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
};

/** 解析 "28.20%" / "41.33s" / "1,680" / 28.2 → number */
const toNum = (v) => {
  if (v === null || v === undefined) return NaN;
  const s = String(v).replace(/[,\s%"']/g, "").replace(/[sS秒]$/, "").trim();
  if (s === "" || s === "-" || s === "—") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** 解析日期 "2026-08-29 18:00" / "2026/08/29" → Date（本地零点） */
const toDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

// ── CSV 解析（支持 BOM、引号内换行、CRLF）────────────────

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

// ── 列名识别（中文表头别名）────────────────────────────

const FIELD_ALIASES = {
  title: ["视频描述", "作品标题", "标题", "视频标题", "作品名称"],
  publishTime: ["发布时间", "发布日期", "发布时间", "创建时间"],
  plays: ["播放量", "播放次数", "播放"],
  likes: ["喜欢", "点赞数", "点赞"],
  comments: ["评论量", "评论数", "评论"],
  shares: ["分享量", "转发数", "转发", "分享"],
  follows: ["关注量", "涨粉数", "新增关注", "关注"],
  recommends: ["推荐"],
  completion: ["完播率"],
  avgWatch: ["平均播放时长"],
  // 抖音特有：首屏与收藏口径（视频号缺失，门禁 W1/W2 依赖这些列是否存在）
  p5s: ["5s完播率", "5秒完播率", "5s完播"],
  bounce2s: ["2s跳出率", "2秒跳出率", "2s跳出"],
  favorites: ["收藏量", "收藏数", "收藏"],
  homeVisits: ["主页访问量", "主页访问"],
};

/**
 * 护栏指标（指标字典 3.4）：硬底线，不做收益权衡，越界即上报。
 * 与数据质量门禁分开——门禁管"数据能不能用"，护栏管"内容有没有踩红线"，
 * 后者与数据完整性无关，**门禁阻断时也必须检查并上报**。
 */
const GUARDRAILS = [
  {
    id: "G1",
    name: "零数字铁律（标题禁用百分比数字钩子）",
    // 命中示例：「99%的人」「90%人不知道」「3 成的人都」；「4 件/4 句话」等数量词不算违规
    pattern: /\d+(?:\.\d+)?\s*%|百分之[零一二三四五六七八九十百千\d]+|\d+\s*成(?:的)?人/,
    level: "硬护栏",
    target: "= 100%",
    action: "立即整改标题；已发布作品评估下架重发",
  },
];

const findCol = (header, key) => {
  const aliases = FIELD_ALIASES[key] || [];
  for (const a of aliases) {
    const i = header.findIndex((h) => String(h).trim() === a);
    if (i >= 0) return i;
  }
  for (const a of aliases) {
    const i = header.findIndex((h) => String(h).includes(a));
    if (i >= 0) return i;
  }
  return -1;
};

/** 读 CSV → 归一化记录数组 */
const loadTable = (file) => {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(abs)) return { error: `文件不存在：${file}`, rows: [] };
  const rows = parseCsv(fs.readFileSync(abs, "utf8"));
  // 平台导出的表常有前置说明行，找到含"播放"且能识别标题列的那一行作为表头
  let hi = rows.findIndex((r) => r.some((c) => /播放/.test(c)) && r.length > 4);
  if (hi < 0) hi = 0;
  const header = rows[hi].map((h) => String(h).trim());
  const idx = Object.fromEntries(Object.keys(FIELD_ALIASES).map((k) => [k, findCol(header, k)]));
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const get = (k) => (idx[k] >= 0 ? (r[idx[k]] ?? "") : "");
    const title = String(get("title")).replace(/\s+/g, " ").trim();
    if (!title) continue;
    out.push({
      title,
      publishDate: toDate(get("publishTime")),
      publishRaw: String(get("publishTime")).trim(),
      plays: toNum(get("plays")),
      likes: toNum(get("likes")),
      comments: toNum(get("comments")),
      shares: toNum(get("shares")),
      follows: toNum(get("follows")),
      recommends: toNum(get("recommends")),
      completion: toNum(get("completion")),
      avgWatch: toNum(get("avgWatch")),
      p5s: toNum(get("p5s")),
      bounce2s: toNum(get("bounce2s")),
      favorites: toNum(get("favorites")),
      homeVisits: toNum(get("homeVisits")),
    });
  }
  return { rows: out, header, missingCols: Object.entries(idx).filter(([, v]) => v < 0).map(([k]) => k) };
};

// ── 统计：Bootstrap + 置换检验 ─────────────────────────

/** Bootstrap 百分位置信区间（对统计量的抽样分布） */
const bootstrapCI = (sample, statFn = median, iters = 4000, seed = 20260902) => {
  const rand = mulberry32(seed);
  const n = sample.length;
  if (n < 2) return { lo: NaN, hi: NaN, point: statFn(sample) };
  const stats = [];
  for (let i = 0; i < iters; i++) {
    const s = [];
    for (let j = 0; j < n; j++) s.push(sample[Math.floor(rand() * n)]);
    stats.push(statFn(s));
  }
  stats.sort((a, b) => a - b);
  return { lo: quantile(stats, 0.025), hi: quantile(stats, 0.975), point: statFn(sample) };
};

/** 两样本置换检验（差异统计量 = 中位数之差）；样本小时做精确枚举 */
const permutationTest = (a, b, iters = 20000, seed = 20260902) => {
  const n1 = a.length, n2 = b.length;
  if (!n1 || !n2) return { p: NaN, diff: NaN, method: "样本为空" };
  const diff = median(a) - median(b);
  const all = [...a, ...b];
  const total = n1 + n2;
  const combos = (() => { // C(total, n1)
    let c = 1;
    for (let i = 0; i < n1; i++) c = (c * (total - i)) / (i + 1);
    return c;
  })();
  const rand = mulberry32(seed);
  let count = 0, trials = 0;
  const shuffledStat = () => {
    const arr = all.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return median(arr.slice(0, n1)) - median(arr.slice(n1));
  };
  if (Number.isFinite(combos) && combos <= 50000) {
    // 精确枚举：用位掩码遍历
    trials = combos;
    for (let mask = 0; mask < 1 << total; mask++) {
      let bits = 0;
      for (let i = 0; i < total; i++) if (mask & (1 << i)) bits++;
      if (bits !== n1) continue;
      const g1 = [], g2 = [];
      for (let i = 0; i < total; i++) (mask & (1 << i) ? g1 : g2).push(all[i]);
      if (Math.abs(median(g1) - median(g2)) >= Math.abs(diff) - 1e-9) count++;
    }
    return { p: count / trials, diff, method: `精确枚举（${trials} 种分法）` };
  }
  trials = iters;
  for (let i = 0; i < iters; i++) {
    if (Math.abs(shuffledStat()) >= Math.abs(diff) - 1e-9) count++;
  }
  return { p: (count + 1) / (trials + 1), diff, method: `蒙特卡洛（${iters} 次重抽样）` };
};

// ── 数据质量门禁 ───────────────────────────────────────

const runDQ = (rows, asof, opts = {}) => {
  const blocks = [];
  const warns = [];
  if (!rows.length) blocks.push(["B0", "数据为空，无记录可分析"]);

  // B1 新鲜度
  if (asof) {
    const days = Math.floor((Date.now() - asof.getTime()) / 86400000);
    if (days > 10) blocks.push(["B1", `数据新鲜度：快照日距今 ${days} 天，超过 10 天`]);
  } else blocks.push(["B1", "未提供 --asof，无法判断新鲜度与成熟度"]);

  // B2 必需字段
  const required = ["publishTime", "plays", "likes", "comments", "shares"];
  const missing = (opts.missingCols || []).filter((c) => required.includes(c));
  if (missing.length) blocks.push(["B2", `必需字段缺失：${missing.join("、")}`]);

  // B3 主键唯一
  const keys = rows.map((r) => `${r.title}|${r.publishRaw}`);
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dup.length) blocks.push(["B3", `主键重复 ${dup.length} 行：${[...new Set(dup)].slice(0, 3).join("；")}`]);

  // B4 数值合法性
  const badNum = rows.filter((r) => ["plays", "likes", "comments", "shares"].some((k) => Number.isFinite(r[k]) && r[k] < 0));
  const nullPlays = rows.filter((r) => !Number.isFinite(r.plays));
  if (badNum.length) blocks.push(["B4", `${badNum.length} 行出现负值`]);
  if (nullPlays.length) blocks.push(["B4", `${nullPlays.length} 行播放量为空/非数值：${nullPlays.slice(0, 3).map((r) => r.title.slice(0, 20)).join("；")}`]);

  // B5 数值逻辑一致
  const illogical = rows.filter((r) => Number.isFinite(r.plays) && r.plays > 0 &&
    ["likes", "comments", "shares"].some((k) => Number.isFinite(r[k]) && r[k] > r.plays));
  if (illogical.length) blocks.push(["B5", `${illogical.length} 行互动数大于播放量：${illogical.slice(0, 3).map((r) => r.title.slice(0, 20)).join("；")}`]);

  // B6 时间可解析
  const noDate = rows.filter((r) => !r.publishDate);
  if (noDate.length) blocks.push(["B6", `${noDate.length} 行发布时间无法解析`]);
  const future = asof ? rows.filter((r) => r.publishDate && r.publishDate > asof) : [];
  if (future.length) blocks.push(["B6", `${future.length} 行发布时间晚于快照日`]);

  // B7 台账识别率（由 --unmatched 传入，缺省视为通过但标注）
  if (opts.unmatched !== undefined) {
    const rate = rows.length ? opts.unmatched / rows.length : 1;
    if (rate > 0.1) blocks.push(["B7", `台账未识别率 ${pct(rate)}，超过 10% 上限`]);
  }

  // W1 账号概览：有"粉丝增量/关注量"字段可算净涨粉，但仍算不出涨粉率 → 半警告
  if (!opts.hasProfile) {
    const hasFollowField = rows.some((r) => Number.isFinite(r.follows));
    if (hasFollowField) {
      warns.push({ id: "W1", name: "账号概览表（部分满足）", w: 12, note: "有单条涨粉数，可算周净涨粉；缺粉丝总数，涨粉率与粉丝渗透率不可计算" });
    } else {
      warns.push({ id: "W1", name: "账号概览表", w: 25, note: "涨粉率、粉丝渗透率不可计算" });
    }
  }
  // W2 首屏指标：5s 完播率 或 2s 跳出率 任一存在即视为可得（抖音提供，视频号缺）
  const hasFirstScreen = rows.some((r) => Number.isFinite(r.p5s) || Number.isFinite(r.bounce2s));
  if (!hasFirstScreen) warns.push({ id: "W2", name: "首屏指标（3秒留存/2秒跳出）", w: 15, note: "首屏钩子效果无法量化" });
  // W3/W4 快照覆盖
  if (asof) {
    const matured = rows.filter((r) => r.publishDate);
    const lc = opts.lifecycleEvidence;
    if (lc && lc.stable) {
      // 已证实"D3 后停止增长"→ D7 不再是必需口径，改用 M≥3 覆盖度考核，扣分减半
      const m3 = matured.filter((r) => maturityDays(r, asof) >= 3).length;
      const rate3 = matured.length ? m3 / matured.length : 0;
      if (rate3 < 0.8) warns.push({ id: "W3", name: "D3+ 覆盖（D7 已豁免）", w: 10, note: `已实测 D3 后增长率 ${pct(lc.growth, 2)}，D7 非必需；但 M≥3 仅覆盖 ${pct(rate3)}（${m3}/${matured.length}）` });
    } else {
      const d7 = matured.filter((r) => maturityDays(r, asof) >= 7).length;
      const rate7 = matured.length ? d7 / matured.length : 0;
      if (rate7 < 0.8) warns.push({ id: "W3", name: "D7 快照覆盖", w: 20, note: `覆盖 ${pct(rate7)}（${d7}/${matured.length}），北极星指标降级为观察` });
    }
    const d1 = matured.filter((r) => maturityDays(r, asof) === 1).length;
    const rate1 = matured.length ? d1 / matured.length : 0;
    if (rate1 < 0.8) warns.push({ id: "W4", name: "D1 快照覆盖", w: 15, note: `覆盖 ${pct(rate1)}（${d1}/${matured.length}），长尾系数与起量速度分析不可用` });
  }
  // W5 存量单调性（需上期快照）
  if (!opts.prevFile) warns.push({ id: "W5", name: "存量作品单调性", w: 10, note: "未提供上期快照，无法检查数据回撤" });

  const aging = opts.aging || {}; // { W1: 3, W2: 2 }
  let score = 100;
  const warnRows = warns.map((w) => {
    const age = aging[w.id] || 0;
    const penalty = w.w + (age >= 3 ? 10 : 0);
    score -= penalty;
    return { ...w, age, penalty };
  });
  if (blocks.length) score = 0;

  let level = "D";
  if (!blocks.length) level = score >= 90 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D";
  const allowed = { A: "全套深度分析，结论可升为结论级", B: "周复盘+描述性分析，结论最高假设级", C: "仅监测层告警，不做题材归因", D: "阻断：只出缺口清单，请补数" }[level];

  return { blocks, warns: warnRows, score: Math.max(0, score), level, allowed };
};

const maturityDays = (r, asof) =>
  r.publishDate && asof ? Math.round((asof - r.publishDate) / 86400000) : NaN;

// ── 报告生成 ───────────────────────────────────────────

const enrich = (rows, asof) =>
  rows.map((r) => {
    const M = maturityDays(r, asof);
    const p = Number.isFinite(r.plays) ? r.plays : NaN;
    return {
      ...r,
      M,
      bucket: !Number.isFinite(M) ? "M?" : M >= 7 ? "D7" : M >= 3 ? "D3" : M >= 1 ? "D1" : "D0",
      likeRate: p ? r.likes / p : NaN,
      shareRate: p ? r.shares / p : NaN,
      followRate: p ? r.follows / p : NaN,
      recRate: p ? r.recommends / p : NaN,
    };
  });

const markBucket = (M) => (!Number.isFinite(M) ? "M?" : M >= 7 ? "D7" : M >= 3 ? "D3" : M >= 1 ? "D1" : "D0");

/**
 * 内容生命周期分析：同一批作品在两个快照之间的增量。
 * 用于回答"内容在第 N 天还能涨多少"——决定长尾系数 K 是否可用、
 * 以及"该加更还是提质量"的真实前提。
 * 匹配键：标题去空白后前 12 字（同平台内标题稳定，跨平台不适用）。
 */
const lifecyclePairs = (curRows, prevRows) => {
  const norm = (t) => String(t).replace(/\s+/g, "").slice(0, 12);
  const prevMap = new Map();
  for (const p of prevRows) if (!prevMap.has(norm(p.title))) prevMap.set(norm(p.title), p);
  const pairs = [];
  for (const c of curRows) {
    const p = prevMap.get(norm(c.title));
    if (!p || !Number.isFinite(c.plays) || !Number.isFinite(p.plays)) continue;
    pairs.push({
      title: c.title,
      M: c.M,
      prevM: p.M,
      prevPlays: p.plays,
      curPlays: c.plays,
      delta: c.plays - p.plays,
      growth: p.plays > 0 ? (c.plays - p.plays) / p.plays : NaN,
    });
  }
  return pairs.sort((a, b) => (b.M ?? -1) - (a.M ?? -1));
};

// ── main ──────────────────────────────────────────────

const main = () => {
  const args = parseArgs();
  const files = [];
  // 上期文件按平台分别指定；未指定平台专用参数时才回落到通用 --prev
  if (args.wechat) files.push({ platform: "视频号", file: args.wechat, prev: args["prev-wechat"] || args.prev });
  if (args.douyin) files.push({ platform: "抖音", file: args.douyin, prev: args["prev-douyin"] || args.prev });
  if (!files.length) {
    console.error("用法：node scripts/analytics/deep-metrics.mjs --wechat=<csv> --asof=YYYY-MM-DD [--prev=<csv> --prev-asof=YYYY-MM-DD] [--topics=<json>] [--dq-only] [--out=<md>]");
    process.exit(1);
  }
  const asof = args.asof ? toDate(args.asof) : null;
  const prevAsOf = args["prev-asof"] ? toDate(args["prev-asof"]) : null;

  let topics = null;
  if (args.topics) {
    const p = path.isAbsolute(args.topics) ? args.topics : path.join(ROOT, args.topics);
    if (fs.existsSync(p)) topics = JSON.parse(fs.readFileSync(p, "utf8"));
    else console.warn(`⚠️ 题材映射文件不存在：${args.topics}，跳过分组检验`);
  }

  const out = [];
  const say = (s = "") => out.push(s);
  const platformRows = {}; // 收集各平台记录，供末尾跨平台配对分析使用

  say(`# 深度指标分析`);
  say(`> 生成时间：${new Date().toISOString().slice(0, 10)} ｜ 脚本：scripts/analytics/deep-metrics.mjs`);
  say(`> 快照日：${args.asof || "未提供"}　上期快照日：${args["prev-asof"] || "无"}`);
  say();

  for (const { platform, file, prev: entryPrev } of files) {
    const { rows: raw, missingCols, error } = loadTable(file);
    say(`## ${platform}｜${path.basename(file)}`);
    if (error) { say(`❌ ${error}`); say(); continue; }
    say();

    // 门禁前置：先算"D3 后是否停止增长"的证据，用于决定 D7 快照是否为必需口径。
    // 依据方法库"成熟度标准化"：若内容 D3 后不再增长，D7 与 D3 等价，D7 缺口不再阻断分析。
    let lcEvidence = null;
    if (entryPrev && prevAsOf && asof) {
      const { rows: praw0 } = loadTable(entryPrev);
      if (praw0.length) {
        const pairs0 = lifecyclePairs(enrich(raw, asof), enrich(praw0, prevAsOf));
        const mature0 = pairs0.filter((p) => Number.isFinite(p.M) && p.M >= 3);
        if (mature0.length >= 2) {
          const g = median(mature0.map((p) => p.growth).filter(Number.isFinite));
          lcEvidence = { n: mature0.length, growth: g, stable: Number.isFinite(g) && g < 0.02 };
        }
      }
    }

    const dq = runDQ(raw, asof, {
      missingCols,
      hasProfile: Boolean(args.profile),
      unmatched: args.unmatched ? Number(args.unmatched) : undefined,
      prevFile: entryPrev,
      aging: args.aging ? JSON.parse(args.aging) : {},
      lifecycleEvidence: lcEvidence,
    });

    // ⓪ 护栏检查（硬底线，与数据完整性无关，门禁阻断时也必须上报）
    {
      const hits = [];
      for (const r of raw) {
        for (const g of GUARDRAILS) {
          const m = String(r.title).match(new RegExp(g.pattern.source, "g"));
          if (m) hits.push({ g, title: r.title, tokens: [...new Set(m)].slice(0, 3) });
        }
      }
      say(`### ⓪ 护栏检查（硬底线，不做收益权衡）`);
      say();
      if (!hits.length) {
        say(`✅ **全部通过**（${raw.length} 条，执行率 100%）`);
      } else {
        const rate = 1 - hits.length / raw.length;
        say(`> ⛔ **护栏越界：${hits.length} / ${raw.length} 条，执行率 ${pct(rate)}**（要求 ${hits[0].g.target}）`);
        say(`> 依据指标字典 3.4：硬护栏**任何播放收益都不换**。此检查与数据完整性无关，门禁未通过时同样上报。`);
        say();
        say(`| 作品 | 违规项 | 命中 | 处置 |`);
        say(`|---|---|---|---|`);
        for (const h of hits) say(`| ${h.title.slice(0, 26)} | ${h.g.name} | ${h.tokens.join("、")} | ${h.g.action} |`);
      }
      say();
    }

    // ① 数据质量门禁
    say(`### ① 数据质量门禁`);
    say();
    say(`**评分：${dq.score} / 100（${dq.level} 级）｜允许动作：${dq.allowed}**`);
    say();
    if (dq.blocks.length) {
      say(`**阻断项（不出报告，先补数）：**`);
      say();
      say(`| 项 | 问题 |`);
      say(`|---|---|`);
      for (const [id, msg] of dq.blocks) say(`| ${id} | ${msg} |`);
      say();
    } else {
      say(`阻断项 B1–B7：**全部通过** ✅`);
      say();
    }
    if (dq.warns.length) {
      say(`| 警告项 | 连续缺欠 | 扣分 | 后果 |`);
      say(`|---|---|---|---|`);
      for (const w of dq.warns) say(`| ${w.id} ${w.name} | ${w.age} 周 | −${w.penalty} | ${w.note} |`);
      say();
    }

    // 门禁为 D 级（阻断项不通过，或扣分后 < 50）→ 只出缺口清单
    if (dq.level === "D") {
      say(`> ⛔ **门禁未通过（${dq.level} 级，${dq.score} 分）**。以下分析暂不出具，请按上表补数后重跑。`);
      say(`> 本脚本门禁规则：D 级只输出缺口清单，不做题材归因与统计检验。`);
      say();
      if (!args.force) continue;
      say(`> 🔓 **--force 已启用**：以下为内部预览数据，仅供分析师判断"值不值得补数"，**严禁粘入正式报告或据以下结论**。`);
      say();
    }

    if (args["dq-only"]) { say(); continue; }

    const rows = enrich(raw, asof);
    platformRows[platform] = rows;
    // 基线口径：默认 D7；若已实测"D3 后停止增长"，则 M≥3 的作品可视为近似终值，用作临时基线
    const useM3 = Boolean(lcEvidence && lcEvidence.stable);
    const baseRows = rows.filter((r) => (useM3 ? Number.isFinite(r.M) && r.M >= 3 : r.bucket === "D7"));
    const baseline = median(baseRows.map((r) => r.plays));

    // ② 单条明细
    say(`### ② 单条明细（成熟度 + 派生比率）`);
    say();
    say(`| 作品 | M | 熟度桶 | 播放 | 完播率 | 均播(s) | 点赞率 | 分享率 | 关注率 | R |`);
    say(`|---|---|---|---|---|---|---|---|---|---|`);
    for (const r of [...rows].sort((a, b) => (b.plays || 0) - (a.plays || 0))) {
      const R = Number.isFinite(r.plays) && Number.isFinite(baseline) && baseline > 0 ? r.plays / baseline : NaN;
      say(`| ${r.title.slice(0, 28)} | ${Number.isFinite(r.M) ? r.M : "?"} | ${r.bucket} | ${num(r.plays)} | ${Number.isFinite(r.completion) ? r.completion.toFixed(2) + "%" : "—"} | ${Number.isFinite(r.avgWatch) ? r.avgWatch.toFixed(2) : "—"} | ${pct(r.likeRate, 2)} | ${pct(r.shareRate, 2)} | ${pct(r.followRate, 2)} | ${Number.isFinite(R) ? R.toFixed(2) : "—"} |`);
    }
    say();
    say(`> R = 单条播放 ÷ 基线中位数（${num(baseline)}，口径：${useM3 ? `M≥3 近似终值，n=${baseRows.length}` : `D7，n=${baseRows.length}`}）；R≥2 进爆款归因，R≤0.5 触发告警。`);
    if (useM3) say(`> 注：已实测本平台内容在 D3 后停止增长（增长率中位数 ${pct(lcEvidence.growth, 2)}），故 M≥3 作品可近似互相比较；M<3 作品的 R 值仍偏低估，仅作参考。`);
    say();

    // ③ 同熟度排行
    say(`### ③ 同熟度排行（跨成熟度禁止混排）`);
    say();
    for (const b of ["D7", "D3", "D1"]) {
      const g = rows.filter((r) => r.bucket === b).sort((x, y) => y.plays - x.plays);
      say(`**${b} 榜**（${g.length} 条）`);
      say();
      if (!g.length) { say(`— 无 —`); say(); continue; }
      say(`| # | 作品 | 播放 | 完播率 |`);
      say(`|---|---|---|---|`);
      g.forEach((r, i) => say(`| ${i + 1} | ${r.title.slice(0, 30)} | ${num(r.plays)} | ${Number.isFinite(r.completion) ? r.completion.toFixed(2) + "%" : "—"} |`));
      say();
    }
    const unknown = rows.filter((r) => r.bucket === "M?");
    if (unknown.length) {
      say(`> ⚠️ ${unknown.length} 条成熟度未知，已排除出排行：${unknown.map((r) => r.title.slice(0, 18)).join("；")}`);
      say();
    }

    // ④ 内容生命周期（同作品跨快照追踪）
    // 前提：本期与上期快照存在重叠作品。这是判断"长尾系数是否可用"的直接证据，
    // 也是"该加更还是提质量"这个决策的真实前提——若内容 D3 后不再增长，
    // 则长尾复利不存在，增长只能靠"多发"或"单条起量更快"。
    let pRows = null;
    if (entryPrev && prevAsOf) {
      const { rows: praw } = loadTable(entryPrev);
      if (praw.length) pRows = enrich(praw, prevAsOf);
    }
    if (pRows) {
      const pairs = lifecyclePairs(rows, pRows);
      const spanDays = Math.round((asof - prevAsOf) / 86400000);
      say(`### ④ 内容生命周期（同作品跨快照追踪）`);
      say();
      if (!pairs.length) {
        say(`— 两期快照无重叠作品，无法追踪生命周期 —`);
        say();
      } else {
        say(`> 快照间隔 **${spanDays} 天**；下表为同一批作品在两次快照间的播放增量，按当前成熟度 M 倒序。`);
        say();
        say(`| 作品 | 发布→当前 M | 上期播放 | 本期播放 | 增量 | 期间增长率 |`);
        say(`|---|---|---|---|---|---|`);
        for (const p of pairs) {
          say(`| ${p.title.slice(0, 26)} | M=${Number.isFinite(p.M) ? p.M : "?"} | ${num(p.prevPlays)} | ${num(p.curPlays)} | ${p.delta >= 0 ? "+" : ""}${num(p.delta)} | ${pct(p.growth, 2)} |`);
        }
        say();
        // 按成熟度分组看衰减：M≥3 视为"已过起量期"
        const mature = pairs.filter((p) => Number.isFinite(p.M) && p.M >= 3);
        const young = pairs.filter((p) => Number.isFinite(p.M) && p.M < 3);
        const medGrowth = (xs) => median(xs.map((p) => p.growth).filter(Number.isFinite));
        say(`| 分组 | 条数 | 期间增长率中位数 | 解读 |`);
        say(`|---|---|---|---|`);
        if (mature.length) say(`| M ≥ 3（已过起量期） | ${mature.length} | ${pct(medGrowth(mature), 2)} | ${medGrowth(mature) < 0.02 ? "**基本停止增长，内容已见顶**" : "仍在增长，存在长尾"} |`);
        if (young.length) say(`| M < 3（起量期内） | ${young.length} | ${pct(medGrowth(young), 2)} | 起量期，增长主要发生在此 |`);
        say();
        const mg = mature.length ? medGrowth(mature) : NaN;
        if (Number.isFinite(mg) && mg < 0.02) {
          say(`> ⛔ **关键结论：内容在 D3 后基本停止增长**（M≥3 作品期间增长率中位数 ${pct(mg, 2)}）。`);
          say(`> 推论：① 长尾系数 K ≈ 1，本账号内容**不存在长尾复利**；② 单条价值在发布后 48–72 小时内兑现完毕；`);
          say(`> ③ 因此增长只能来自 **发布密度** 或 **D1 起量速度**，而非"等它慢慢涨"；④ 同熟度对比中，M≥3 的作品可近似互相比较（差异主要来自内容质量而非成熟度）。`);
        } else if (Number.isFinite(mg)) {
          say(`> ⚠️ M≥3 作品仍以 ${pct(mg, 2)}/期的速度增长，长尾存在但较弱，D7 快照仍建议补齐以精确计量。`);
        }
        say();
      }
    }

    // ⑤ 增长分解
    if (pRows) {
      const n0 = pRows.length, n1 = rows.length;
        const t0 = pRows.reduce((s, r) => s + (Number.isFinite(r.plays) ? r.plays : 0), 0);
        const t1 = rows.reduce((s, r) => s + (Number.isFinite(r.plays) ? r.plays : 0), 0);
        const a0 = n0 ? t0 / n0 : 0, a1 = n1 ? t1 / n1 : 0;
        const scale = (n1 - n0) * a0;
        const eff = n0 * (a1 - a0);
        const cross = (n1 - n0) * (a1 - a0);
        const delta = t1 - t0;
        say(`### ⑤ 增长分解（该加更还是提质量？）`);
        say();
        say(`| 项 | 计算 | 数值 | 占增量 |`);
        say(`|---|---|---|---|`);
        say(`| 上期 | ${n0} 条 × ${num(a0, 1)} | ${num(t0)} | — |`);
        say(`| 本期 | ${n1} 条 × ${num(a1, 1)} | ${num(t1)} | — |`);
        say(`| **总增量** | — | **${num(delta)}** | 100% |`);
        say(`| 规模效应（条数） | (${n1}−${n0}) × ${num(a0, 1)} | ${num(scale)} | ${delta ? pct(scale / delta) : "—"} |`);
        say(`| 效率效应（单条） | ${n0} × ${num(a1 - a0, 1)} | ${num(eff)} | ${delta ? pct(eff / delta) : "—"} |`);
        say(`| 交叉效应 | — | ${num(cross)} | ${delta ? pct(cross / delta) : "—"} |`);
        say();
        const effShare = delta ? (eff + cross) / delta : 0;
        say(`> ⚠️ 若本期含未跑满 7 天的作品，效率效应存在高估风险，快照补齐后需重算。`);
        say();
        // 重叠度检查：若两期快照作品高度重叠，总量分解会重复计数，结论不可直接用
        const normT = (t) => String(t).replace(/\s+/g, "").slice(0, 12);
        const curSet = new Set(rows.map((r) => normT(r.title)));
        const overlapN = pRows.filter((r) => curSet.has(normT(r.title))).length;
        const overlapRate = pRows.length ? overlapN / pRows.length : 0;
        if (overlapRate >= 0.5) {
          say(`> ⛔ **本分解不可用**：上期 ${pRows.length} 条中有 **${overlapN} 条（${pct(overlapRate)}）与本期重叠**，两期并非两个独立发布批次，而是同一批作品的两个快照。`);
          say(`> 此时"规模效应 vs 效率效应"的拆分失去意义（同一条内容被计了两次），**上表数字不得引用**。判断该加更还是提质量，请以下一节"播放集中度"为准。`);
        } else {
          say(`> **结论**：增量的 **${pct(effShare)}** 来自单条效率（效率+交叉），**${pct(1 - effShare)}** 来自发布条数。`);
          say(`> → ${effShare >= 0.6 ? "**优先提升单条质量，不宜加更**" : effShare <= 0.4 ? "**增量主要靠发布密度，可考虑加更**" : "两者贡献相当，需分别验证"}`);
        }
        say();
      }

    // ⑤+ 播放集中度：判断增长该靠"赌爆款"还是"堆数量"
    {
      const ps = rows.map((r) => r.plays).filter(Number.isFinite).sort((a, b) => b - a);
      const tot = ps.reduce((s, x) => s + x, 0);
      const top = (k) => ps.slice(0, k).reduce((s, x) => s + x, 0) / tot;
      const cv = (() => {
        const m = ps.reduce((s, x) => s + x, 0) / ps.length;
        const sd = Math.sqrt(ps.reduce((s, x) => s + (x - m) ** 2, 0) / ps.length);
        return sd / m;
      })();
      say(`### ⑥ 播放集中度（赌爆款 vs 堆数量）`);
      say();
      say(`| 指标 | 数值 | 解读 |`);
      say(`|---|---|---|`);
      say(`| 单条播放中位数 | ${num(median(ps))} | 一条内容的"典型产出" |`);
      say(`| 单条播放均值 | ${num(ps.reduce((s, x) => s + x, 0) / ps.length, 1)} | 均值>中位数说明被爆款拉高 |`);
      say(`| Top1 占比 | ${pct(top(1))} | — |`);
      say(`| Top2 占比（前 25%） | ${pct(top(2))} | — |`);
      say(`| 变异系数 CV | ${cv.toFixed(2)} | <0.4 均匀 / 0.4–0.7 中等 / >0.7 高度集中 |`);
      say();
      say(`> → ${cv > 0.7 ? "**高度集中**：少数爆款贡献大部分播放，应优先研究'什么让某条爆'（提质量/复刻爆款），加更的边际收益有限。" : cv < 0.4 ? "**产出均匀**：单条差异小，增长主要靠发布密度（加更）稳定累积。" : "**中等集中**：爆款与基本盘并存，建议保基本盘 + 用 20% 产能试爆款。"}`);
      say();
    }

    // ⑥ 题材分组检验
    if (topics) {
      const assign = (title) => {
        for (const [topic, kws] of Object.entries(topics)) {
          if (!Array.isArray(kws)) continue; // 跳过 "_说明" 等非映射键
          if (kws.some((k) => title.includes(k))) return topic;
        }
        return null;
      };
      const groups = {};
      let unassigned = 0;
      for (const r of rows) {
        const t = assign(r.title);
        if (!t) { unassigned++; continue; }
        (groups[t] ||= []).push(r);
      }
      say(`### ⑦ 题材分组检验（Bootstrap CI + 置换检验）`);
      say();
      const stats = Object.entries(groups).map(([topic, rs]) => {
        const comp = rs.map((r) => r.completion).filter(Number.isFinite);
        const plays = rs.map((r) => r.plays).filter(Number.isFinite);
        return {
          topic,
          n: rs.length,
          maturityMix: [...new Set(rs.map((r) => r.bucket))].join("/"),
          compMedian: median(comp),
          compCI: comp.length >= 2 ? bootstrapCI(comp, median, 4000) : null,
          playMedian: median(plays),
          playCI: plays.length >= 2 ? bootstrapCI(plays, median, 4000) : null,
          rs,
        };
      });
      say(`| 题材 | n | 成熟度构成 | 完播率中位数 | 95% CI | 播放中位数 | 95% CI |`);
      say(`|---|---|---|---|---|---|---|`);
      for (const s of stats) {
        const mixed = s.maturityMix.includes("/");
        say(`| ${s.topic} | ${s.n} | ${s.maturityMix}${mixed ? " ⚠️" : ""} | ${Number.isFinite(s.compMedian) ? s.compMedian.toFixed(2) + "%" : "—"} | ${s.compCI ? `${s.compCI.lo.toFixed(1)}~${s.compCI.hi.toFixed(1)}` : "样本<2"} | ${num(s.playMedian)} | ${s.playCI ? `${num(s.playCI.lo)}~${num(s.playCI.hi)}` : "样本<2"} |`);
      }
      say();
      if (stats.some((s) => s.maturityMix.includes("/"))) {
        say(`> ⚠️ 部分题材组内成熟度不一致（同组混有不同 D 桶），该组对比**未满足可比性前提**，结果仅作登记，不得作为题材优劣依据。需待 D7 快照覆盖 ≥80% 后重测。`);
        say();
      }
      if (unassigned) say(`> 未命中题材关键词 ${unassigned} 条，归入「未分类」，**不参与分组检验**（避免硬猜）。`);
      say();

      // 两两对比（只对样本量最大的两组做，避免组合爆炸）
      if (stats.length >= 2) {
        const sorted = [...stats].sort((a, b) => b.n - a.n).slice(0, 2);
        const [A, B] = sorted;
        const av = A.rs.map((r) => r.completion).filter(Number.isFinite);
        const bv = B.rs.map((r) => r.completion).filter(Number.isFinite);
        if (av.length && bv.length) {
          const t = permutationTest(av, bv);
          const dCI = bootstrapCI(av, median, 4000, 777);
          say(`**对比：${A.topic}（n=${av.length}） vs ${B.topic}（n=${bv.length}）｜完播率**`);
          say();
          say(`- 中位数之差：**${t.diff.toFixed(2)}pp**（${A.topic} − ${B.topic}）`);
          say(`- 置换检验：**p = ${t.p.toFixed(3)}**（${t.method}，双尾）`);
          say(`- ${A.topic} 完播率 Bootstrap 95% CI：${dCI.lo.toFixed(1)}% ~ ${dCI.hi.toFixed(1)}%`);
          const sig = t.p < 0.05;
          const level = A.n < 5 || B.n < 5 ? "观察" : A.n < 8 || B.n < 8 ? "假设" : "结论";
          say(`- **判定**：${sig ? "CI/检验达显著" : "**未达显著（p ≥ 0.05）**"} → 结论级别：**${level}**（n=${av.length}+${bv.length}）`);
          say(`- **处置**：${sig && level === "结论" ? "可写入规范" : "进观察队列，累计至 n≥8 再定论；不得据此确立题材优劣规范"}`);
          say();
          say(`> 提醒：**p ≥ 0.05 不等于"没有差异"，而是"证据不足"**。前者是暂不写规范，后者才是停止投入，两者动作完全不同。`);
          say();
        }
      }
    }

    // ⑥ 待补数据
    say(`### ⑧ 待补数据清单`);
    say();
    say(`| 缺口 | 影响 | 处置 |`);
    say(`|---|---|---|`);
    for (const w of dq.warns) say(`| ${w.name} | ${w.note} | ☐ 补数 ☐ 正式从指标字典降级 |`);
    if (!dq.warns.length) say(`| — | 无缺口 | — |`);
    say();
  }

  // ── 跨平台配对分析（方法库方法四：配对设计）──────────────
  // 同一条内容在两平台发布、且成熟度相同时直接比较，天然控制"题材/发布时间"两个混淆变量。
  const platNames = Object.keys(platformRows);
  if (platNames.length >= 2) {
    const [pa, pb] = platNames;
    const A = platformRows[pa], B = platformRows[pb];
    const bigrams = (t) => {
      const s = String(t).replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "");
      const set = new Set();
      for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
      return set;
    };
    const pairs = [];
    for (const a of A) {
      const ba = bigrams(a.title);
      if (!ba.size) continue;
      let best = null;
      for (const b of B) {
        const bb = bigrams(b.title);
        if (!bb.size) continue;
        let inter = 0;
        for (const g of ba) if (bb.has(g)) inter++;
        const score = inter / Math.min(ba.size, bb.size);
        if (score >= 0.3 && a.bucket === b.bucket && (!best || score > best.score)) best = { b, score };
      }
      if (best) pairs.push({ a, b: best.b });
    }
    say(`## 跨平台配对分析（${pa} vs ${pb}）`);
    say();
    say(`> 方法：**配对设计**——同一条内容在两平台发布，**成熟度相同**时直接比较，天然控制"题材 × 发布时间"两个混淆变量。`);
    say(`> 匹配：标题 bigram 相似度 ≥0.3 **且**成熟度桶一致；成功配对 **${pairs.length}** 对。`);
    say();
    if (pairs.length < 2) {
      say(`— 可配对作品不足 2 对，无法做配对检验 —`);
      say();
    } else {
      const ratios = [];
      say(`| 内容 | 熟度 | ${pa}播放 | ${pb}播放 | 比值 ${pa}/${pb} |`);
      say(`|---|---|---|---|---|`);
      for (const p of pairs) {
        const r = p.b.plays > 0 ? p.a.plays / p.b.plays : NaN;
        if (Number.isFinite(r)) ratios.push({ ...p, ratio: r });
        say(`| ${p.a.title.slice(0, 24)} | ${p.a.bucket} | ${num(p.a.plays)} | ${num(p.b.plays)} | ${Number.isFinite(r) ? r.toFixed(2) : "—"} |`);
      }
      say();
      const rv = ratios.map((r) => r.ratio);
      const n = rv.length;
      const medR = median(rv);
      const pos = rv.filter((x) => x > 1).length;
      // 符号检验（精确二项，H0：比值中位数 = 1）
      const binom = (k, N) => { let r = 1; for (let i = 0; i < k; i++) r = (r * (N - i)) / (i + 1); return r; };
      const k = Math.max(pos, n - pos);
      let single = 0;
      for (let i = k; i <= n; i++) single += binom(i, n) / 2 ** n;
      const pTwo = Math.min(1, 2 * single);
      say(`| 统计量 | 值 |`);
      say(`|---|---|`);
      say(`| 配对数 n | ${n} |`);
      say(`| 比值中位数 | ${medR.toFixed(2)} |`);
      say(`| 比值范围 | ${Math.min(...rv).toFixed(2)} ~ ${Math.max(...rv).toFixed(2)} |`);
      say(`| 符号检验双尾 p | ${pTwo.toFixed(3)} |`);
      say();
      say(`> → ${pTwo < 0.05 ? `**差异显著**：同等条件下 **${medR > 1 ? pa : pb}** 播放更高（中位比 ${medR.toFixed(2)}）` : `**未达显著**（p=${pTwo.toFixed(3)}）：两平台整体播放无可靠差异，中位比 ${medR.toFixed(2)}`}`);
      say();
      if (topics) {
        const assign = (title) => {
          for (const [topic, kws] of Object.entries(topics)) {
            if (!Array.isArray(kws)) continue;
            if (kws.some((kk) => title.includes(kk))) return topic;
          }
          return null;
        };
        const byTopic = {};
        for (const r of ratios) {
          const t = assign(r.a.title) || assign(r.b.title);
          if (!t) continue;
          (byTopic[t] ||= []).push(r.ratio);
        }
        const tList = Object.entries(byTopic).filter(([, v]) => v.length >= 2).map(([t, v]) => ({ t, m: median(v), n: v.length })).sort((x, y) => y.m - x.m);
        if (tList.length >= 2) {
          say(`**平台 × 题材交互**（同题材在两平台的比值中位数）`);
          say();
          say(`| 题材 | 配对数 | 比值中位数 | 偏向 |`);
          say(`|---|---|---|---|`);
          for (const x of tList) say(`| ${x.t} | ${x.n} | ${x.m.toFixed(2)} | ${x.m >= 1.3 ? `**${pa} 明显更强**` : x.m <= 0.77 ? `**${pb} 明显更强**` : "无系统差异"} |`);
          say();
          const hi = tList[0], lo = tList[tList.length - 1];
          if (hi.m / lo.m >= 1.5) {
            say(`> 🔥 **交互效应成立**：${hi.t} 的比值中位 **${hi.m.toFixed(2)}**，${lo.t} 仅 **${lo.m.toFixed(2)}**，相差 **${(hi.m / lo.m).toFixed(1)} 倍**。`);
            say(`> 含义：**同一条内容不该在两平台同等投放**——${hi.t} 应优先投 ${pa}，${lo.t} 应优先投 ${pb}。`);
            say(`> ⚠️ 结论级别：**观察**（配对数有限，且题材内样本量小）。需累计至各题材 ≥6 对再升为结论；在此之前按"低风险试做"执行，不作为规范。`);
            say();
          }
        }
      }
    }
  }

  const md = out.join("\n");
  if (args.out) {
    const p = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, md, "utf8");
    console.log(`✅ 已输出：${p}`);
  } else {
    console.log(md);
  }
};

main();
