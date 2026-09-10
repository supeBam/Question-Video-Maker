import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTimeline } from "../../src/types.ts";

// ── 一键出片（--compose-tts）相关路径 ─────────────────────
const PYTHON_BIN = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
  ".venv-asr",
  "bin",
  "python"
);
const TTS_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "gen-burst-tts.py"
);

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

// 发布平台：用于在单个文案文件里分段标注「视频号 / 抖音」
export const PUBLISH_PLATFORMS = {
  douyin: "抖音",
  wechat: "视频号",
};

export const getPublishTextPath = (videoPath) => {
  return videoPath.slice(0, -4) + ".txt";
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

/**
 * 一键出片前置步骤（--compose-tts）：
 *   调 gen-burst-tts.py 增量合成每道题配音 → 写出音频 mp3 + measurements.json。
 *   返回 measurements 对象，供 renderVideoWithCover 注入到 Remotion props。
 *
 * videoLabel 缺省取 episodeLabel（与脚本内默认一致）。
 */
const runComposeTts = ({ dataPath, videoLabel, extraArgs = [] }) => {
  if (!fs.existsSync(PYTHON_BIN)) {
    throw new Error(
      `一键出片需要 .venv-asr/bin/python，但没找到：${PYTHON_BIN}\n` +
        `当前脚本只在含 .venv-asr 的本机可用；其他机器请改走剪映手工配音（不带 --compose-tts）。`
    );
  }
  const args = [
    TTS_SCRIPT,
    `--data=${dataPath}`,
    ...(videoLabel ? [`--video-label=${videoLabel}`] : []),
    ...extraArgs,
  ];
  console.log(`\n🎙️  合成配音（MiniMax TTS）→`);
  const result = spawnSync(PYTHON_BIN, args, {
    stdio: "inherit",
    cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`TTS 合成失败，退出码 ${result.status}`);
  }

  // 读 measurements.json：与 .py 写文件约定对齐
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );
  const inferredLabel = videoLabel ?? (() => {
    // 读题库兜底：episodeLabel 去掉空格
    try {
      const d = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
      return d?.meta?.episodeLabel?.replace(/\s+/g, "");
    } catch {
      return null;
    }
  })();
  const measurementsPath = inferredLabel
    ? path.join(projectRoot, "out", `${inferredLabel}-audio-measurements.json`)
    : null;
  if (!measurementsPath || !fs.existsSync(measurementsPath)) {
    throw new Error(
      `TTS 合成完成但未找到 measurements.json：${measurementsPath ?? "(video-label 无法推断)"}`
    );
  }
  const payload = JSON.parse(fs.readFileSync(measurementsPath, "utf-8"));
  return {
    measurements: payload.measurements,
    measurementsPath,
    seriesDir: payload.seriesDir,
    fps: payload.fps,
    outroHookMs: payload.outroHookMs,
  };
};

// ── SRT generation ────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const formatSrtTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const generateSrt = (data, srtPath, opts = {}) => {
  // 用与视频渲染完全一致的 buildTimeline 推导时间轴，保证字幕与画面逐帧对齐
  const timeline = buildTimeline(data);
  const { fps, hookFrames, outroFrames, slots, totalFrames } = timeline;
  const sec = (frames) => frames / fps;

  const blocks = [];
  let idx = 1;

  // 开场标题字幕：快闪模板取钩子开场段（零钩子时不生成空字幕块）
  const introTitle = data.intro?.title?.replace(/\n/g, "，") ?? "";
  if (introTitle && hookFrames > 0) {
    blocks.push(
      `${idx}`,
      `00:00:00,000 --> ${formatSrtTime(sec(hookFrames))}`,
      introTitle,
      ""
    );
    idx++;
  }

  for (const slot of slots) {
    const q = slot.question;
    const start = sec(slot.from);
    const end = sec(slot.from + slot.durationInFrames);

    if (slot.kind === "fill") {
      // 填空题：题干字幕（呈现 + 思考）+ 答案字幕（揭晓）
      const stemEnd = sec(slot.from + slot.presentFrames + slot.countdownFrames);
      blocks.push(
        `${idx}`,
        `${formatSrtTime(start)} --> ${formatSrtTime(stemEnd)}`,
        q.stem.replace(/\n/g, " "),
        ""
      );
      idx++;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(stemEnd)} --> ${formatSrtTime(end)}`,
        q.answer,
        ""
      );
      idx++;
    } else {
      // 选择题：题干字幕（呈现 + 倒计时）+ 答案字幕（揭晓）
      const stemEnd = sec(slot.from + slot.presentFrames + slot.countdownFrames);
      blocks.push(
        `${idx}`,
        `${formatSrtTime(start)} --> ${formatSrtTime(stemEnd)}`,
        q.stem.replace(/\n/g, " "),
        ""
      );
      idx++;

      const answerLine = `正确答案：${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}`;
      // 快闪模式：每题只出 2 条字幕（题干 / 正确答案），
      // 真相一句只出现在画面、不进字幕（字幕条数与题数成对，且与画面严格对齐）
      blocks.push(
        `${idx}`,
        `${formatSrtTime(stemEnd)} --> ${formatSrtTime(end)}`,
        answerLine,
        ""
      );
      idx++;
    }
  }

  // 片尾钩子字幕：默认输出（供剪映 TTS 口播钩子）；
  // 不需要口播钩子时用 --no-outro-hook 关闭（有 outro.hook 才输出）
  const hook = opts.outroHookSrt ? data.outro?.hook : undefined;
  if (hook) {
    const minimalOutro = data.timing.minimalOutro === true;
    const hookStartSec = sec(totalFrames - outroFrames);
    if (minimalOutro) {
      // 极简片尾（无片尾帧）：钩子口播从视频结束点开始（约 4.5 字/秒 + 缓冲）
      const hookDur = Math.max(2, Math.ceil(hook.length / 4.5 + 0.8));
      blocks.push(
        `${idx}`,
        `${formatSrtTime(hookStartSec)} --> ${formatSrtTime(hookStartSec + hookDur)}`,
        hook,
        ""
      );
    } else {
      // 文字版片尾：钩子口播落在片尾段内
      blocks.push(
        `${idx}`,
        `${formatSrtTime(hookStartSec)} --> ${formatSrtTime(sec(totalFrames))}`,
        hook,
        ""
      );
    }
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

// 抖音话题上限：平台规则「视频标题话题最多 5 个」，去重后超出即截断（视频号无此硬限）
const DOUYIN_MAX_HASHTAGS = 5;

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

  // 抖音强制 ≤5 个话题（平台硬限制），无论话题来自栏目映射还是 publish 覆盖
  const finalHashtags =
    platform === "douyin" ? hashtags.slice(0, DOUYIN_MAX_HASHTAGS) : hashtags;

  return { title, hashtags: finalHashtags };
};

export const generatePublishText = (data, publishTextPath) => {
  // 视频号在前、抖音在后，合并写进同一个 txt
  const content = ["wechat", "douyin"]
    .map((platform) => {
      const { title, hashtags } = derivePublish(data, platform);
      return [
        `【${PUBLISH_PLATFORMS[platform]}】`,
        `标题：${title}`,
        "",
        `话题：${hashtags.join(" ")}`,
        "",
      ].join("\n");
    })
    .join("\n");
  fs.writeFileSync(publishTextPath, content, "utf-8");
  console.log(`发布文案 →  ${publishTextPath}  (视频号 + 抖音)`);
};

// ── main ──────────────────────────────────────────────────

export const renderVideoWithCover = (
  videoPath = "out/burst-quiz.mp4",
  options = {}
) => {
  const {
    dataPath = "src/data/questions.json",
    srtOnly = false,
    /** 片尾钩子口播字幕：默认输出（供剪映手工配音）；false 时去掉 SRT 片尾钩子段 */
    outroHookSrt = true,
    /** 一键出片：先调 gen-burst-tts.py 合成配音 + 测音频时长，再渲染带配音视频。
     *  启用时 SRT 默认跳过（口播已在视频里，无需字幕）。 */
    composeTts = false,
    /** 一键出片时覆盖默认 video-label（缺省取 episodeLabel） */
    videoLabel,
    /** 透传给 gen-burst-tts.py 的额外参数（如 --voice-stem=male-qn-jingying） */
    ttsExtraArgs = [],
  } = options;
  // 快闪模板（唯一模式）：合成固定为 BurstQuiz
  const compositionId = "BurstQuiz";

  // 统一以项目根目录为工作目录：remotion 配置、src/、out/ 都相对它解析
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../.."
  );
  if (process.cwd() !== projectRoot) {
    process.chdir(projectRoot);
  }

  const coverPath = getCoverPath(videoPath);
  const srtPath = getSrtPath(videoPath);
  const publishTextPath = getPublishTextPath(videoPath);

  // 读取题库数据：视频渲染、字幕、发布文案共用同一份数据
  const questionsPath = path.resolve(projectRoot, dataPath);
  const data = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));

  // ── 一键出片前置：合成配音 + 拿 measurements ──
  let audioMeasurements = undefined;
  let outroHookMs = undefined;
  if (composeTts) {
    const r = runComposeTts({
      dataPath: questionsPath,
      videoLabel,
      extraArgs: ttsExtraArgs,
    });
    audioMeasurements = r.measurements;
    outroHookMs = r.outroHookMs;
  }

  // 把题库包成 props 写入临时 JSON 文件，让 remotion render/still 按这份数据出片。
  // Remotion 的 --props 同时支持内联 JSON 或一个 JSON 文件路径，这里用文件路径，
  // 避免把含中文与引号的大 JSON 直接拼进命令行（Windows shell 转义极易出错）。
  // props 用「绝对路径 + 正斜杠」，规避 Windows shell / npx.cmd / Remotion 子命令
  // 对相对路径（out/.remotion-props.json）解析不一致导致的「not a valid JSON file」。
  const propsPath = path
    .resolve(projectRoot, "out", ".remotion-props.json")
    .replace(/\\/g, "/");

  // 每次 remotion 子命令前重写 props 并校验存在（防止前一步把文件删掉/锁住）
  const ensureProps = () => {
    fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    // 由模式决定 voiceOver.enabled（不依赖题库字段）：
    //   - 一键出片（--compose-tts）：mp3 已合成 → 强制 true，BurstQuiz 挂载配音
    //   - 手工模式（无 --compose-tts）：静音视频 + SRT → 强制 false，用户去剪映配音
    const renderData = {
      ...data,
      voiceOver: { ...data.voiceOver, enabled: composeTts },
    };
    const propsPayload =
      audioMeasurements !== undefined
        ? {
            data: renderData,
            audioMeasurements,
            ...(outroHookMs !== undefined ? { outroHookMs } : {}),
          }
        : { data: renderData };
    fs.writeFileSync(propsPath, JSON.stringify(propsPayload), "utf-8");
    if (!fs.existsSync(propsPath)) {
      throw new Error(`props 临时文件写入失败：${propsPath}`);
    }
    return propsPath;
  };

  if (!srtOnly) {
    ensureProps();
    console.log(`临时 props → ${propsPath}`);
    try {
      // 1. 渲染视频
      runRemotion([
        "remotion",
        "render",
        compositionId,
        videoPath,
        `--props=${ensureProps()}`,
        "--log=error",
      ]);
      console.log(`视频      →  ${videoPath}`);

      // 2. 渲染封面：有钩子开场时取钩子画面（中点帧），
      //    零片头时取第 1 秒（题目呈现中，对标封面=首帧题目）。
      //    一键出片模式：用 audioMeasurements 算时间轴，保证封面帧号与口播视频同步
      const coverTimeline = buildTimeline(data, { audioMeasurements });
      const coverFrame =
        coverTimeline.hookFrames > 0
          ? Math.round(coverTimeline.hookFrames / 2)
          : 30;
      runRemotion([
        "remotion",
        "still",
        compositionId,
        coverPath,
        `--props=${ensureProps()}`,
        `--frame=${coverFrame}`,
      ]);
      console.log(`封面      →  ${coverPath}`);
    } finally {
      fs.rmSync(propsPath, { force: true });
    }
  }

  // 3. 生成字幕 + 发布文案
  // 一键出片模式默认跳过字幕（口播已在视频里，无需 SRT）
  if (!composeTts) {
    generateSrt(data, srtPath, { outroHookSrt });
  } else {
    console.log(`字幕      →  (一键出片模式已跳过：${srtPath})`);
  }
  generatePublishText(data, publishTextPath);

  return {
    videoPath,
    coverPath,
    srtPath,
    publishTextPath,
  };
};

export const isDirectExecution = (argvPath, moduleUrl) => {
  return Boolean(argvPath) && path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
};

const parseCliArgs = (argv) => {
  const opts = {
    videoPath: "out/burst-quiz.mp4",
    dataPath: "src/data/questions.json",
    srtOnly: false,
    outroHookSrt: true,
    composeTts: false,
    videoLabel: undefined,
    ttsExtraArgs: [],
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--data=")) {
      opts.dataPath = arg.slice("--data=".length);
    } else if (arg === "--srt-only") {
      opts.srtOnly = true;
    } else if (arg === "--no-outro-hook") {
      opts.outroHookSrt = false;
    } else if (arg === "--compose-tts") {
      opts.composeTts = true;
    } else if (arg.startsWith("--video-label=")) {
      opts.videoLabel = arg.slice("--video-label=".length);
    } else if (arg.startsWith("--tts-arg=")) {
      // 透传给 gen-burst-tts.py，如 --tts-arg=--voice-stem=male-qn-jingying
      opts.ttsExtraArgs.push(arg.slice("--tts-arg=".length));
    } else if (arg && !arg.startsWith("--")) {
      opts.videoPath = arg;
    }
  }
  return opts;
};

if (isDirectExecution(process.argv[1], import.meta.url)) {
  try {
    const {
      videoPath, dataPath, srtOnly, outroHookSrt,
      composeTts, videoLabel, ttsExtraArgs,
    } = parseCliArgs(process.argv);
    const result = renderVideoWithCover(videoPath, {
      dataPath,
      srtOnly,
      outroHookSrt,
      composeTts,
      videoLabel,
      ttsExtraArgs,
    });
    console.log("\n✅ 全部完成：");
    console.log(`  视频: ${result.videoPath}`);
    console.log(`  封面: ${result.coverPath}`);
    if (composeTts) {
      console.log(`  字幕: (一键出片模式已跳过；口播已在视频里)`);
    } else {
      console.log(`  字幕: ${result.srtPath}`);
    }
    console.log(`  发布文案: ${result.publishTextPath}  (视频号 + 抖音)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
