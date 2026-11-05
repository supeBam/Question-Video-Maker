import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * 一键发布助手 · 第一步：把出片产物汇总成「机器可读发布清单」。
 *
 * 输入：一条成片（默认自动找同名的 .png 封面 + .txt 发布文案）
 * 输出：out/<期号>-publish.json —— 视频号 / 抖音 各自的待填字段 + 素材绝对路径 + 合规自检
 *
 * 这个脚本只做「取数 + 校验」，不碰浏览器，也不负责平台发布。
 * 后续平台填写应使用当前可用且经用户授权的工作流；不要依赖已移除的历史发布 Skill。
 *
 * 用法：
 *   node scripts/publish/prepare.mjs out/成语-第17期.mp4
 *   node scripts/publish/prepare.mjs --latest                 # out/ 下最新的成片
 *   node scripts/publish/prepare.mjs out/x.mp4 --data=src/data/questions-260910-1.json
 *   node scripts/publish/prepare.mjs --latest --json          # 只打印清单 JSON（供程序消费）
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

// ── 平台限制表 ────────────────────────────────────────────
// 数值来自 2026-09-10 对本机两个后台的实测（页面原文），不是记忆里的旧数字：
//   视频号「上传时长8小时内，大小不超过20GB，建议分辨率720p及以上，码率10Mbps以内，格式为MP4/H.264」
//   抖音  「支持投稿1小时以内、16G以内的视频」「标题内容仅支持30个字符」（超了会被硬截断）
// 平台改版就改这里，发布 SOP 不用动。
export const PLATFORM_LIMITS = {
  wechat: {
    key: "wechat",
    name: "视频号",
    entry: "https://channels.weixin.qq.com/platform/post/create",
    /** 短标题：后台字段叫「短标题」，会出现在公众号、发现页等处 */
    titleField: "短标题",
    titleMax: 16,
    /** 短标题不允许出现标点（平台规则，含标点会展示不全） */
    titleNoPunctuation: true,
    /** 描述（正文）：话题直接以 #词 + 空格 的形式写在里面 */
    captionField: "视频描述",
    captionMax: 1000,
    /** 话题写进正文即可，无独立话题框、无数量硬限 */
    hashtagsMax: null,
    topicsInlineInCaption: true,
    durationMax: 8 * 3600,
    sizeMax: 20 * 1024 * 1024 * 1024,
    /** AI 生成内容声明的位置（实测 2026-09-10） */
    aiLabel: { where: "视频标注", option: "含AI生成内容" },
  },
  douyin: {
    key: "douyin",
    name: "抖音",
    entry: "https://creator.douyin.com/creator-micro/content/upload",
    titleField: "作品标题",
    /** 30 字是硬限：超了平台直接截断，所以这里按 error 处理并自动切到简介 */
    titleMax: 30,
    titleHardLimit: true,
    titleNoPunctuation: false,
    captionField: "作品简介",
    captionMax: 1000,
    hashtagsMax: 5,
    topicsInlineInCaption: true,
    durationMax: 3600,
    sizeMax: 16 * 1024 * 1024 * 1024,
    aiLabel: { where: "自主声明", option: "内容由AI生成" },
  },
};

export const PLATFORM_ORDER = ["wechat", "douyin"];

// 发布文案 txt 里的字段别名 → 统一字段名
const FIELD_ALIASES = {
  短标题: "title",
  标题: "title",
  大标题: "coverText",
  描述: "description",
  简介: "description",
  正文: "description",
  话题: "hashtags",
  标签: "hashtags",
};

const PLATFORM_HINTS = {
  视频号: "wechat",
  抖音: "douyin",
};

// ── helpers ───────────────────────────────────────────────

const stripTag = (s) => String(s).replace(/^#+\s*/, "").trim();

/**
 * 解析发布文案 txt。兼容两种在用的写法：
 *   A. 出片脚本自动生成的紧凑格式：`【视频号】\n标题：…\n话题：…`
 *   B. 手工/对谈流程的详细格式：`## 视频号（…）` + `【短标题】… 【描述】… 【话题】…`
 * 规则：遇到含「视频号 / 抖音」的行就切换当前平台；行内字段用 `【X】值` 或 `X：值` 两种写法都吃。
 */
export const parsePublishText = (raw) => {
  const blocks = { wechat: {}, douyin: {} };
  let current = null;

  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || /^[-=]{3,}$/.test(line)) continue;

    // 平台切换：【视频号】 / ## 视频号（…） / ## 抖音（标题 + 描述 + 话题）
    const headBody = line.replace(/^#+\s*/, "").replace(/^【|】$/g, "");
    const hitPlatform = Object.keys(PLATFORM_HINTS).find((hint) =>
      headBody.startsWith(hint),
    );
    if (hitPlatform && headBody.length <= 24) {
      current = PLATFORM_HINTS[hitPlatform];
      continue;
    }
    if (!current) continue;

    // 【字段】值  —— 同一行写完
    let m = line.match(/^【([^】]+)】(.*)$/);
    if (m) {
      const label = m[1].trim();
      const field = FIELD_ALIASES[label];
      const value = m[2].trim();
      if (field) {
        if (field === "hashtags") blocks[current][field] = parseHashtags(value);
        else if (value) blocks[current][field] = value;
        else blocks[current][field] = ""; // 值可能在下一行
        if (field === "title" && label === "短标题") blocks[current].shortTitleGiven = true;
        blocks[current].__lastField = field;
        continue;
      }
    }

    // 字段：值  —— 冒号式（中英文冒号都吃）
    m = line.match(/^([^\s：:]{1,6})[：:]\s*(.*)$/);
    if (m) {
      const label = m[1];
      const field = FIELD_ALIASES[label];
      if (field) {
        if (field === "hashtags") blocks[current][field] = parseHashtags(m[2]);
        else blocks[current][field] = m[2].trim();
        if (field === "title" && label === "短标题") blocks[current].shortTitleGiven = true;
        blocks[current].__lastField = field;
        continue;
      }
    }

    // 续行：【描述】留空、正文写在下面几行
    const last = blocks[current].__lastField;
    if (last === "description" && !line.startsWith("【")) {
      blocks[current].description = [blocks[current].description, line]
        .filter(Boolean)
        .join(" ");
    }
  }

  for (const p of Object.values(blocks)) delete p.__lastField;
  return blocks;
};

/**
 * 话题解析：话题字段里的每个词都是标签，缺 # 自动补；
 * 顺手吃掉词尾标点（「#成语，#传统文化」这种写法）。
 */
export const parseHashtags = (text) =>
  String(text ?? "")
    .split(/[\s,，、;；/]+/)
    .map((t) => t.trim().replace(/[.。!！?？]+$/, ""))
    .filter((t) => t.length > 1)
    .filter((t) => !/^(无|暂无|待定|TBD)$/i.test(t))
    .map((t) => (t.startsWith("#") ? t : `#${t}`));

const countChars = (s) => [...String(s ?? "")].length;

const hasPunctuation = (s) =>
  /[，。！？；：、“”‘’《》（）,.!?;:'"()\[\]<>~—…·]/.test(String(s ?? ""));

/** ffprobe 取时长与分辨率；没装 ffprobe 就返回 null（清单里标 unknown，不阻断） */
const probeVideo = (absPath) => {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate:format=duration",
      "-of",
      "json",
      absPath,
    ],
    { encoding: "utf-8" },
  );
  if (result.status !== 0) return null;
  try {
    const j = JSON.parse(result.stdout);
    const stream = j.streams?.[0] ?? {};
    const [num, den] = String(stream.r_frame_rate ?? "0/1").split("/");
    return {
      width: stream.width ?? null,
      height: stream.height ?? null,
      fps: den ? Math.round((Number(num) / Number(den)) * 10) / 10 : null,
      durationSec: Math.round(Number(j.format?.duration ?? 0)),
    };
  } catch {
    return null;
  }
};

const abs = (p) => path.resolve(projectRoot, p).replace(/\\/g, "/");

/**
 * 按出片产物的命名约定找封面 + 发布文案。两条内容线命名不同，都在这里兜住：
 *   答题线：   out/<label>.mp4   + out/<label>.png   + out/<label>.txt
 *   国学对谈线：out/<label>-成片.mp4 + out/封面-<label>.png + out/发布内容-<label>.txt
 * 找不到就返回 null，交给调用方报错或用 --cover/--text 手工指定。
 */
export const resolveAssets = (videoAbsPath, root = projectRoot, exists = fs.existsSync) => {
  const dir = path.dirname(videoAbsPath);
  const base = path.basename(videoAbsPath, path.extname(videoAbsPath));
  const stem = base.replace(/-成片$/, "");
  const rel = (f) => path.relative(root, f).replace(/\\/g, "/");

  const tryFiles = (candidates) => {
    for (const c of candidates) {
      if (exists(c)) return rel(c);
    }
    return null;
  };

  const cover = tryFiles([
    path.join(dir, `${base}.png`),
    path.join(dir, `封面-${stem}.png`),
    path.join(dir, `${stem}-cover.png`),
  ]);
  const publishText = tryFiles([
    path.join(dir, `${base}.txt`),
    path.join(dir, `发布内容-${stem}.txt`),
    path.join(dir, `${stem}.txt`),
  ]);
  return { cover, publishText };
};

const latestVideo = () => {
  const dir = path.join(projectRoot, "out");
  if (!fs.existsSync(dir)) throw new Error("out/ 目录不存在");
  const mp4s = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".mp4") && !f.includes("试听"))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!mp4s.length) throw new Error("out/ 下没有成片 mp4");
  return path.join("out", mp4s[0].f);
};

/** 从题库 JSON 补期号/栏目信息（可选，缺失不影响发布） */
const readEpisodeInfo = (dataPath) => {
  if (!dataPath) return {};
  try {
    const data = JSON.parse(fs.readFileSync(abs(dataPath), "utf-8"));
    return {
      series: data.meta?.series ?? null,
      episode: data.meta?.episode ?? null,
      episodeLabel: data.meta?.episodeLabel ?? null,
      challenge: data.publish?.challenge ?? null,
      sourceData: dataPath,
    };
  } catch (e) {
    console.warn(`⚠️  题库 JSON 读取失败（不影响发布）：${e.message}`);
    return {};
  }
};

/** 单平台自检：返回 [{ level: ok|warn|error, text }] */
const checkPlatform = (limit, payload) => {
  const issues = [];
  const push = (level, text) => issues.push({ level, text });

  if (!payload.title) push("warn", `${limit.name}缺少标题，发布前需人工补`);
  if (limit.titleMax && payload.title) {
    const n = countChars(payload.title);
    // 超限不阻断：平台是截断展示，不是拒绝提交
    push(n > limit.titleMax ? "warn" : "ok", `标题 ${n} 字（建议 ≤${limit.titleMax}，超出部分信息流里会被截断）`);
  }
  if (limit.titleNoPunctuation && payload.title && hasPunctuation(payload.title)) {
    push("warn", `标题含标点（${limit.name}短标题规则建议无标点，可能被截断展示）`);
  }
  if (payload.movedFromTitle) {
    push("warn", `标题超 ${limit.titleMax} 字硬限，已把「${payload.movedFromTitle}」并入正文`);
  }
  const captionLen = countChars(payload.captionFull);
  push(captionLen > limit.captionMax ? "error" : "ok", `正文 ${captionLen} 字（上限 ${limit.captionMax}）`);
  if (limit.hashtagsMax) {
    const n = payload.hashtags.length;
    push(n > limit.hashtagsMax ? "error" : "ok", `话题 ${n} 个（上限 ${limit.hashtagsMax}）`);
  }
  return issues;
};

/** 素材体检：时长/体积/比例/封面，任一平台超限就标 error */
const checkMedia = (limit, { probe, sizes, coverPath }) => {
  const issues = [];
  const push = (level, text) => issues.push({ level, text });
  if (!probe) push("warn", "没读到视频元数据（本机缺 ffprobe？），发布前自己看一眼时长");
  else {
    push(
      probe.durationSec > limit.durationMax ? "error" : "ok",
      `时长 ${probe.durationSec}s（上限 ${Math.round(limit.durationMax / 60)} 分钟）`,
    );
    if (probe.width && probe.height) {
      const vertical = probe.height > probe.width;
      push(vertical ? "ok" : "warn", `画面 ${probe.width}×${probe.height}${vertical ? "（竖屏 ✅）" : "（非竖屏，信息流会吃亏）"}`);
    }
  }
  const bytes = sizes?.video?.bytes;
  if (bytes) {
    const mb = Math.round(bytes / 1024 / 1024);
    push(bytes > limit.sizeMax ? "error" : "ok", `体积 ${mb}MB（上限 ${Math.round(limit.sizeMax / 1024 / 1024)}MB）`);
  }
  push(coverPath ? "ok" : "warn", coverPath ? "封面已备好" : "缺封面文件，发布时需平台自动生成或手工选");
  return issues;
};

/**
 * 抖音标题 30 字硬限的切分：超限时找停顿处断开，剩下的并进简介开头。
 * 优先级：句读（，。！？、；：）> 空格 > 硬切。不硬砍（平台砍得更难看），也不加省略号。
 */
export const splitTitle = (title, max) => {
  const chars = [...String(title ?? "")];
  if (!max || chars.length <= max) return { title: String(title ?? ""), moved: "" };
  const STRONG = ["，", "。", "！", "？", "、", "；", "："];
  const WEAK = [" ", "\n", " ", "​"];
  const findCut = (set) => {
    for (let i = Math.min(max, chars.length - 1); i >= 1; i--) {
      if (set.has(chars[i - 1])) return i; // 断开点：保留前一段（含标点）
    }
    return -1;
  };
  const cutStrong = findCut(new Set(STRONG));
  const cutWeak = findCut(new Set(WEAK));
  const cut = cutStrong > 0 ? cutStrong : cutWeak > 0 ? cutWeak : max;
  return {
    title: chars.slice(0, cut).join("").replace(/[，、；：\s]+$/, ""),
    moved: chars.slice(cut).join("").replace(/^\s+/, ""),
  };
};

/**
 * 视频号短标题推导：后台的「短标题」框要 ≤16 字且不带标点。
 * 文案里没单独写短标题时，取第一句（按句读切），去掉残留标点，超长再截。
 *   「笑面虎」出自哪本书？多数人都想错了，答对 8 个算你牛 → 笑面虎出自哪本书
 */
export const deriveShortTitle = (text, max) => {
  const first = [...String(text ?? "").split(/[，。！？；：、\n]/)][0] ?? "";
  const clean = first.replace(/[「」『』《》“”‘’()（）【】！？。，、；：·…\s]/g, "");
  return max ? [...clean].slice(0, max).join("") : clean;
};

/** 生成发布清单（纯函数，方便单测） */
export const buildManifest = ({ label, videoPath, coverPath, publishTextPath, blocks, info, probe, sizes }) => {
  const platforms = {};
  for (const key of PLATFORM_ORDER) {
    const limit = PLATFORM_LIMITS[key];
    const b = blocks[key] ?? {};
    const rawTags = b.hashtags ?? [];
    const hashtags = limit.hashtagsMax
      ? rawTags.slice(0, limit.hashtagsMax)
      : rawTags;
    if (rawTags.length > hashtags.length) {
      console.warn(
        `⚠️  ${limit.name}话题 ${rawTags.length} 个超上限 ${limit.hashtagsMax}，只取前 ${limit.hashtagsMax} 个：${hashtags.join(" ")}`,
      );
    }

    // 标题 / 正文的两种来源：
    //   文案里「短标题 + 描述」分开写了（对谈线）→ 各用各的
    //   只写了一个长标题（答题线）→ 长文本进正文（信息流展示的就是它），
    //     短标题另推一个不带标点的版本（视频号短标题规则：≤16 字、无标点）
    const longText = b.description || b.title || "";
    let title = b.title ?? "";
    if (
      limit.titleNoPunctuation &&
      !b.shortTitleGiven &&
      countChars(title) > limit.titleMax
    ) {
      title = deriveShortTitle(longText || title, limit.titleMax);
    }

    // 标题超硬限（抖音 30 字）→ 自动切，尾巴并进简介，不丢字
    let movedFromTitle = "";
    if (limit.titleHardLimit && title) {
      const split = splitTitle(title, limit.titleMax);
      title = split.title;
      movedFromTitle = split.moved;
    }
    const description = [movedFromTitle, b.description || ""]
      .filter(Boolean)
      .join("");
    // 正文优先用「描述 + 切下来的半句」；没有描述时（答题线的紧凑文案）用长标题原文，
    // 不是被缩短后的短标题——否则长文案会在这一步丢掉。
    const captionBody = description || longText || title;
    const captionFull = [captionBody, hashtags.join(" ")]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");

    const payload = {
      platform: key,
      platformName: limit.name,
      entry: limit.entry,
      title,
      coverText: b.coverText ?? "",
      description: b.description ?? "",
      /** 正文本体（不含话题）。抖音的话题要一个一个「#词 + 回车」补成话题块，
       *  先把这段纯文本填进去，再逐个追话题。 */
      captionBody,
      /** 被自动切出标题、并入正文的那段（抖音 30 字硬限用） */
      movedFromTitle: movedFromTitle || null,
      hashtags,
      /** 实际要填进正文/描述框的完整文本（正文 + 话题） */
      captionFull,
      /** 要投进后台的表单字段（SOP 直接照着填，不再自己拼） */
      fields: {
        [limit.titleField]: title,
        [limit.captionField]: captionFull,
      },
      aiLabel: limit.aiLabel,
      limits: {
        titleMax: limit.titleMax,
        captionMax: limit.captionMax,
        hashtagsMax: limit.hashtagsMax,
      },
      checks: [],
    };
    payload.checks = [
      ...checkPlatform(limit, payload),
      ...checkMedia(limit, { probe, sizes, coverPath }),
    ];
    platforms[key] = payload;
  }

  const manifest = {
    schema: "publish-manifest@1",
    generatedAt: new Date().toISOString(),
    label: label ?? path.basename(videoPath, ".mp4"),
    ...info,
    assets: {
      video: { path: videoPath, absPath: abs(videoPath), ...(sizes?.video ?? {}) },
      cover: coverPath
        ? { path: coverPath, absPath: abs(coverPath), ...(sizes?.cover ?? {}) }
        : null,
      publishText: publishTextPath
        ? { path: publishTextPath, absPath: abs(publishTextPath) }
        : null,
      probe: probe ?? null,
    },
    compliance: {
      aiLabel: true,
      aiLabelNote:
        "两个平台都要求对 AI 生成内容做声明：视频号在「更多设置 → 添加标注」选「由 AI 生成」；抖音在「标注声明」里选「内容由 AI 生成」。这一步不能省，否则有限流/下架风险。",
      humanConfirm: true,
      humanConfirmNote:
        "本清单只负责填表。「发布」按钮永远由人自己点——半自动是为了避开平台的机器发布风控。",
    },
    platforms,
  };

  manifest.blocking = Object.values(platforms).flatMap((p) =>
    p.checks
      .filter((c) => c.level === "error")
      .map((c) => `${p.platformName}：${c.text}`),
  );
  return manifest;
};

// ── CLI ───────────────────────────────────────────────────

const parseCliArgs = (argv) => {
  const opts = {
    videoPath: null,
    latest: false,
    dataPath: null,
    coverPath: null,
    publishTextPath: null,
    json: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--latest") opts.latest = true;
    else if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--data=")) opts.dataPath = arg.slice(7);
    else if (arg.startsWith("--cover=")) opts.coverPath = arg.slice(8);
    else if (arg.startsWith("--text=")) opts.publishTextPath = arg.slice(7);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (!arg.startsWith("--")) opts.videoPath = arg;
  }
  return opts;
};

const printHuman = (m) => {
  const line = "─".repeat(52);
  console.log(`\n${line}\n发布清单 · ${m.label}\n${line}`);
  console.log(`成片    ${m.assets.video.path}${m.assets.probe?.durationSec ? `（${m.assets.probe.durationSec}s / ${m.assets.probe.width}×${m.assets.probe.height}）` : ""}`);
  console.log(`封面    ${m.assets.cover?.path ?? "❌ 缺封面"}`);
  if (m.series) console.log(`栏目    ${m.series}${m.episode ? ` · 第 ${m.episode} 期` : ""}`);
  for (const key of PLATFORM_ORDER) {
    const p = m.platforms[key];
    console.log(`\n【${p.platformName}】  ${p.entry}`);
    if (p.title) console.log(`  ${Object.keys(p.fields)[0]}  ${p.title}`);
    console.log(`  ${Object.keys(p.fields)[1]}  ${p.captionFull}`);
    for (const c of p.checks) {
      const icon = c.level === "ok" ? "✅" : c.level === "warn" ? "⚠️ " : "❌";
      console.log(`    ${icon} ${c.text}`);
    }
  }
  console.log(`\n${line}`);
  if (m.blocking.length) {
    console.log(`❌ 有 ${m.blocking.length} 项超限，先改文案再发：`);
    m.blocking.forEach((b) => console.log(`   · ${b}`));
  } else {
    console.log(`✅ 自检通过。下一步：让助手按清单填表（只填不发）`);
    console.log(`   指令：把 out/${path.basename(m.assets.video.path, ".mp4")}-publish.json 的内容填到视频号 + 抖音后台，我来点发布`);
  }
};

if (isDirect()) {
  main();
}

function isDirect() {
  return (
    process.argv[1] &&
    path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
  );
}

function main() {
  const opts = parseCliArgs(process.argv);
  if (opts.help) {
    console.log(
      "用法：node scripts/publish/prepare.mjs <成片.mp4 | --latest> [选项]\n" +
        "  --data=<题库.json>    带上栏目/期号（写进清单，便于登记台账）\n" +
        "  --cover=<封面.png>    手工指定封面（默认按命名约定自动找）\n" +
        "  --text=<发布文案.txt>  手工指定文案（默认按命名约定自动找）\n" +
        "  --json                只输出清单 JSON（供程序/助手读取）",
    );
    return;
  }
  try {
    const videoPath = opts.latest ? latestVideo() : opts.videoPath;
    if (!videoPath) throw new Error("缺少成片路径（或加 --latest 自动取 out/ 下最新成片）");
    const vAbs = abs(videoPath);
    if (!fs.existsSync(vAbs)) throw new Error(`成片不存在：${videoPath}`);

    const base = path.basename(vAbs, ".mp4");
    const stem = base.replace(/-成片$/, "");
    const resolved = resolveAssets(vAbs);
    const coverPath = opts.coverPath ?? resolved.cover;
    const publishTextPath = opts.publishTextPath ?? resolved.publishText;
    if (!coverPath) {
      console.warn(`⚠️  没找到封面（试过 ${stem}.png / 封面-${stem}.png），发布时需手工选封面`);
    }
    if (!publishTextPath) {
      throw new Error(
        `没找到发布文案：${stem}.txt / 发布内容-${stem}.txt\n（出片时会自动生成；手工流程请先补这份 txt，格式见 docs/答题出片-使用说明.md）`,
      );
    }

    const raw = fs.readFileSync(abs(publishTextPath), "utf-8");
    const blocks = parsePublishText(raw);
    if (!blocks.wechat.title && !blocks.douyin.title &&
        !blocks.wechat.description && !blocks.douyin.description) {
      throw new Error(`发布文案里没解析出任何平台字段：${publishTextPath}`);
    }

    const sizes = {
      video: { bytes: fs.statSync(vAbs).size },
      cover: coverPath ? { bytes: fs.statSync(abs(coverPath)).size } : {},
    };
    const manifest = buildManifest({
      label: stem,
      videoPath: path.relative(projectRoot, vAbs),
      coverPath,
      publishTextPath,
      blocks,
      info: readEpisodeInfo(opts.dataPath),
      probe: probeVideo(vAbs),
      sizes,
    });

    const outPath = path.join(
      projectRoot,
      "out",
      `${manifest.label}-publish.json`,
    );
    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

    if (opts.json) console.log(JSON.stringify({ ...manifest, manifestPath: path.relative(projectRoot, outPath) }, null, 2));
    else {
      printHuman(manifest);
      console.log(`\n清单    →  ${path.relative(projectRoot, outPath)}`);
    }
    if (manifest.blocking.length) process.exitCode = 2;
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
