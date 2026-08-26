import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ── helpers ───────────────────────────────────────────────

export const getCoverPath = (videoPath) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }
  return videoPath.slice(0, -4) + ".png";
};

export const getSrtPath = (videoPath) => {
  return videoPath.slice(0, -4) + ".srt";
};

// 发布平台：对应两个平台的发布文案文件
export const PUBLISH_PLATFORMS = {
  douyin: "抖音",
  wechat: "视频号",
};

export const getPublishTextPath = (videoPath, platform) => {
  const label = PUBLISH_PLATFORMS[platform];
  if (!label) throw new Error(`未知发布平台：${platform}`);
  return videoPath.slice(0, -4) + `.${label}.txt`;
};

const runRemotion = (args) => {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// ── SRT generation ────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const DEFAULT_CROSSWORD_TIMING = { displaySeconds: 45, answerSeconds: 7 };
const DEFAULT_FILL_TIMING = {
  presentSeconds: 3.5,
  countdownSeconds: 6,
  revealSeconds: 7,
};

const formatSrtTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const generateSrt = (data, srtPath) => {
  const { timing, questions } = data;
  const { fps, introSeconds, outroSeconds, perQuestion } = timing;
  const presentSec = perQuestion.presentSeconds;
  const countdownSec = perQuestion.countdownSeconds;
  const revealSec = perQuestion.revealSeconds;
  const perQ = presentSec + countdownSec + revealSec;
  const crosswordTiming = timing.crossword ?? DEFAULT_CROSSWORD_TIMING;
  const fillTiming = timing.fill ?? DEFAULT_FILL_TIMING;

  let cursor = introSeconds;
  const blocks = [];
  let idx = 1;

  // 标题字幕（开场阶段）
  const introTitle = data.intro?.title?.replace(/\n/g, "，") ?? "";
  if (introTitle) {
    blocks.push(
      `${idx}`,
      `00:00:00,000 --> ${formatSrtTime(introSeconds)}`,
      introTitle,
      ""
    );
    idx++;
  }

  for (const q of questions) {
    const isCw = q.type === "crossword";
    const isFill = q.type === "fill";

    // 该题型单题总时长（秒）
    let qDur;
    if (isCw) {
      const ov = q.timingOverride ?? {};
      qDur =
        (ov.displaySeconds ?? crosswordTiming.displaySeconds) +
        (ov.answerSeconds ?? crosswordTiming.answerSeconds);
    } else if (isFill) {
      const ov = q.timingOverride ?? {};
      const fPresent = ov.presentSeconds ?? fillTiming.presentSeconds;
      const fCountdown = ov.countdownSeconds ?? fillTiming.countdownSeconds;
      const fReveal = ov.revealSeconds ?? fillTiming.revealSeconds;
      qDur = fPresent + fCountdown + fReveal;
    } else {
      qDur = perQ;
    }
    const qStart = cursor;

    if (isCw) {
      // 诗词填字纵横：整段一条字幕（展示 + 答案页合并）
      const qEnd = cursor + qDur;
      const blanks = [];
      for (const clue of q.clues) {
        for (const bi of clue.blanks ?? []) blanks.push(clue.text[bi]);
      }
      const lineCount = q.clues.length;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(qStart)} --> ${formatSrtTime(qEnd)}`,
        `诗词填字：共 ${lineCount} 句诗纵横交织，补全 ${blanks.length} 个字：${blanks.join(" ")}`,
        ""
      );
      idx++;
    } else if (isFill) {
      // 填空题：题干字幕（呈现 + 思考）+ 答案字幕（揭晓）
      const ov = q.timingOverride ?? {};
      const fPresent = ov.presentSeconds ?? fillTiming.presentSeconds;
      const fCountdown = ov.countdownSeconds ?? fillTiming.countdownSeconds;
      const stem = q.stem.replace(/\n/g, " ");

      const qEnd = cursor + fPresent + fCountdown;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(qStart)} --> ${formatSrtTime(qEnd)}`,
        stem,
        ""
      );
      idx++;

      const aEnd = cursor + qDur;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(qEnd)} --> ${formatSrtTime(aEnd)}`,
        q.answer,
        ""
      );
      idx++;
    } else {
      // 选择题：题干字幕（呈现 + 倒计时）+ 答案字幕（揭晓）
      const stem = q.stem.replace(/\n/g, " ");
      const letter = LETTERS[q.answerIndex];
      const answerText = q.options[q.answerIndex];

      const qEnd = cursor + presentSec + countdownSec;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(qStart)} --> ${formatSrtTime(qEnd)}`,
        stem,
        ""
      );
      idx++;

      const aStart = qEnd;
      const aEnd = cursor + qDur;
      const punchline = q.punchline ? `。${q.punchline}` : "";
      blocks.push(
        `${idx}`,
        `${formatSrtTime(aStart)} --> ${formatSrtTime(aEnd)}`,
        `正确答案：${letter}. ${answerText}${punchline}`,
        ""
      );
      idx++;
    }

    cursor += qDur;
  }

  // 片尾钩子字幕（可选：有 outro.hook 才输出，供后期 TTS 口播）
  const hook = data.outro?.hook;
  if (hook) {
    blocks.push(
      `${idx}`,
      `${formatSrtTime(cursor)} --> ${formatSrtTime(cursor + outroSeconds)}`,
      hook,
      ""
    );
    idx++;
  }

  fs.writeFileSync(srtPath, blocks.join("\n"), "utf-8");
  console.log(`SRT 字幕  →  ${srtPath}  (${idx - 1} 条)`);
};

// ── 发布文案生成 ────────────────────────────────────────

// 栏目 → 核心内容标签（两个平台共用）
const SERIES_TAGS = {
  中国文化冷知识: ["#冷知识", "#传统文化", "#古诗词", "#中国文化"],
  中国文学名句: ["#文学", "#古诗词", "#传统文化"],
  中国文学常识: ["#文学", "#传统文化"],
  中国历史冷知识: ["#历史", "#冷知识", "#传统文化"],
  中国朝代历史: ["#历史", "#中国历史"],
  万物雅称: ["#万物雅称", "#传统文化", "#古诗词", "#中国文化"],
};

const FALLBACK_TAGS = ["#传统文化"];

// 抖音额外追加的泛流量标签，扩大推荐池
const DOUYIN_EXTRA_TAGS = ["#涨知识", "#知识分享"];

const unique = (arr) => [...new Set(arr)];

const normalizeHashtags = (tags) =>
  tags
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));

const splitTitleLines = (title) =>
  (title ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export const derivePublish = (data, platform) => {
  const series = (data.meta?.series ?? "").trim();
  const lines = splitTitleLines(data.intro?.title);
  const shortTitle = lines[0] ?? "";
  const fullTitle = lines.join(" ");

  const global = data.publish ?? {};
  const override = global[platform] ?? {};

  const title =
    override.title ??
    global.title ??
    (platform === "douyin" ? shortTitle : fullTitle);

  const coreTags = normalizeHashtags(
    global.hashtags ?? SERIES_TAGS[series] ?? FALLBACK_TAGS
  );
  const hashtags = normalizeHashtags(
    override.hashtags ??
      (platform === "douyin"
        ? unique([...coreTags, ...DOUYIN_EXTRA_TAGS])
        : coreTags)
  );

  return { title, hashtags };
};

export const generatePublishText = (data, publishTextPath, platform) => {
  const { title, hashtags } = derivePublish(data, platform);
  const content = [
    "【标题】",
    title,
    "",
    "【话题】",
    hashtags.join(" "),
    "",
  ].join("\n");
  fs.writeFileSync(publishTextPath, content, "utf-8");
  console.log(`发布文案(${PUBLISH_PLATFORMS[platform]}) →  ${publishTextPath}`);
};

// ── main ──────────────────────────────────────────────────

export const renderVideoWithCover = (
  videoPath = "out/literature-quiz.mp4",
  options = {}
) => {
  const {
    compositionId = "LiteratureQuiz",
    dataPath = "src/data/questions.json",
    srtOnly = false,
  } = options;

  const coverPath = getCoverPath(videoPath);
  const srtPath = getSrtPath(videoPath);
  const publishDouyinPath = getPublishTextPath(videoPath, "douyin");
  const publishWechatPath = getPublishTextPath(videoPath, "wechat");

  if (!srtOnly) {
    // 1. 渲染视频
    runRemotion([
      "remotion",
      "render",
      compositionId,
      videoPath,
      "--log=error",
    ]);
    console.log(`视频      →  ${videoPath}`);

    // 2. 渲染封面
    runRemotion(["remotion", "still", compositionId, coverPath, "--frame=90"]);
    console.log(`封面      →  ${coverPath}`);
  }

  // 3. 生成字幕 + 发布文案
  const questionsPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    dataPath
  );
  const data = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
  generateSrt(data, srtPath);
  generatePublishText(data, publishDouyinPath, "douyin");
  generatePublishText(data, publishWechatPath, "wechat");

  return {
    videoPath,
    coverPath,
    srtPath,
    publishDouyinPath,
    publishWechatPath,
  };
};

export const isDirectExecution = (argvPath, moduleUrl) => {
  return Boolean(argvPath) && path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
};

const parseCliArgs = (argv) => {
  const opts = {
    videoPath: "out/literature-quiz.mp4",
    compositionId: "LiteratureQuiz",
    dataPath: "src/data/questions.json",
    srtOnly: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--composition=")) {
      opts.compositionId = arg.slice("--composition=".length);
    } else if (arg.startsWith("--data=")) {
      opts.dataPath = arg.slice("--data=".length);
    } else if (arg === "--srt-only") {
      opts.srtOnly = true;
    } else if (arg && !arg.startsWith("--")) {
      opts.videoPath = arg;
    }
  }
  return opts;
};

if (isDirectExecution(process.argv[1], import.meta.url)) {
  try {
    const { videoPath, compositionId, dataPath, srtOnly } = parseCliArgs(process.argv);
    const result = renderVideoWithCover(videoPath, { compositionId, dataPath, srtOnly });
    console.log("\n✅ 全部完成：");
    console.log(`  视频: ${result.videoPath}`);
    console.log(`  封面: ${result.coverPath}`);
    console.log(`  字幕: ${result.srtPath}`);
    console.log(`  发布文案(抖音): ${result.publishDouyinPath}`);
    console.log(`  发布文案(视频号): ${result.publishWechatPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
