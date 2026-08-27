import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTimeline } from "../src/types.ts";

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

// ── SRT generation ────────────────────────────────────────

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const formatSrtTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const generateSrt = (data, srtPath) => {
  // 用与视频渲染完全一致的 buildTimeline 推导时间轴，保证字幕与画面逐帧对齐
  const timeline = buildTimeline(data);
  const { fps, introFrames, outroFrames, slots, totalFrames } = timeline;
  const sec = (frames) => frames / fps;

  const blocks = [];
  let idx = 1;

  // 标题字幕（开场阶段）
  const introTitle = data.intro?.title?.replace(/\n/g, "，") ?? "";
  if (introTitle) {
    blocks.push(
      `${idx}`,
      `00:00:00,000 --> ${formatSrtTime(sec(introFrames))}`,
      introTitle,
      ""
    );
    idx++;
  }

  for (const slot of slots) {
    const q = slot.question;
    const start = sec(slot.from);
    const end = sec(slot.from + slot.durationInFrames);

    if (slot.kind === "crossword") {
      // 诗词填字纵横：整段一条字幕（展示 + 答案页合并）
      const blanks = [];
      for (const clue of q.clues) {
        for (const bi of clue.blanks ?? []) blanks.push(clue.text[bi]);
      }
      const lineCount = q.clues.length;
      blocks.push(
        `${idx}`,
        `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
        `诗词填字：共 ${lineCount} 句诗纵横交织，补全 ${blanks.length} 个字：${blanks.join(" ")}`,
        ""
      );
      idx++;
    } else if (slot.kind === "fill") {
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
      // 选择题：题干字幕（呈现 + 倒计时）+ 答案字幕（揭晓，含「一句话真相」口播）
      const stemEnd = sec(slot.from + slot.presentFrames + slot.countdownFrames);
      blocks.push(
        `${idx}`,
        `${formatSrtTime(start)} --> ${formatSrtTime(stemEnd)}`,
        q.stem.replace(/\n/g, " "),
        ""
      );
      idx++;

      const answerLine = `正确答案：${LETTERS[q.answerIndex]}. ${q.options[q.answerIndex]}`;
      const punchline = q.punchline ?? "";
      const revealDur = end - stemEnd;

      if (punchline) {
        // 按字数比例拆分揭晓时长：答案与真相各占一段，避免一条长文本朗读溢出压到下一题
        const total = answerLine.length + punchline.length;
        const answerDur = revealDur * (answerLine.length / total);
        const punchStart = stemEnd + answerDur;
        blocks.push(
          `${idx}`,
          `${formatSrtTime(stemEnd)} --> ${formatSrtTime(punchStart)}`,
          answerLine,
          ""
        );
        idx++;
        blocks.push(
          `${idx}`,
          `${formatSrtTime(punchStart)} --> ${formatSrtTime(end)}`,
          punchline,
          ""
        );
        idx++;
      } else {
        blocks.push(
          `${idx}`,
          `${formatSrtTime(stemEnd)} --> ${formatSrtTime(end)}`,
          answerLine,
          ""
        );
        idx++;
      }
    }
  }

  // 片尾钩子字幕（可选：有 outro.hook 才输出，供后期 TTS 口播）
  const hook = data.outro?.hook;
  if (hook) {
    blocks.push(
      `${idx}`,
      `${formatSrtTime(sec(totalFrames - outroFrames))} --> ${formatSrtTime(sec(totalFrames))}`,
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
  videoPath = "out/literature-quiz.mp4",
  options = {}
) => {
  const { dataPath = "src/data/questions.json", srtOnly = false } = options;
  // 渲染一律走 LiteratureQuiz 合成（支持三种题型混排），题库内容由 --data 决定
  const compositionId = "LiteratureQuiz";

  // 统一以项目根目录为工作目录：remotion 配置、src/、out/ 都相对它解析
  const projectRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
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

  // 把题库包成 props 写入临时 JSON 文件，让 remotion render/still 按这份数据出片。
  // Remotion 的 --props 同时支持内联 JSON 或一个 JSON 文件路径，这里用文件路径，
  // 避免把含中文与引号的大 JSON 直接拼进命令行（Windows shell 转义极易出错）。
  // props 路径用「相对项目根 + 正斜杠」（out/.remotion-props.json），
  // 避免 Windows shell / npx.cmd 对反斜杠绝对路径（D:\...）的转义问题。
  const propsPath = path.join("out", ".remotion-props.json").replace(/\\/g, "/");

  if (!srtOnly) {
    fs.mkdirSync(path.dirname(propsPath), { recursive: true });
    fs.writeFileSync(propsPath, JSON.stringify({ data }), "utf-8");
    if (!fs.existsSync(propsPath)) {
      throw new Error(`props 临时文件写入失败：${path.resolve(propsPath)}`);
    }
    console.log(`临时 props → ${propsPath}`);
    try {
      // 1. 渲染视频
      runRemotion([
        "remotion",
        "render",
        compositionId,
        videoPath,
        `--props=${propsPath}`,
        "--log=error",
      ]);
      console.log(`视频      →  ${videoPath}`);

      // 2. 渲染封面
      runRemotion([
        "remotion",
        "still",
        compositionId,
        coverPath,
        `--props=${propsPath}`,
        "--frame=90",
      ]);
      console.log(`封面      →  ${coverPath}`);
    } finally {
      fs.rmSync(propsPath, { force: true });
    }
  }

  // 3. 生成字幕 + 发布文案
  generateSrt(data, srtPath);
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
    videoPath: "out/literature-quiz.mp4",
    dataPath: "src/data/questions.json",
    srtOnly: false,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--data=")) {
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
    const { videoPath, dataPath, srtOnly } = parseCliArgs(process.argv);
    const result = renderVideoWithCover(videoPath, { dataPath, srtOnly });
    console.log("\n✅ 全部完成：");
    console.log(`  视频: ${result.videoPath}`);
    console.log(`  封面: ${result.coverPath}`);
    console.log(`  字幕: ${result.srtPath}`);
    console.log(`  发布文案: ${result.publishTextPath}  (视频号 + 抖音)`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
