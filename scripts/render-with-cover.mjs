import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildTimeline } from "../src/types.ts";
import { computeAnswerPages } from "../src/answerSheet.ts";

// ── helpers ───────────────────────────────────────────────

export const getCoverPath = (videoPath) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }
  return videoPath.slice(0, -4) + ".png";
};

/** 片尾钩子图路径（发布配图 / 评论区置顶图）：out/<期号>-钩子.png */
export const getHookImagePath = (videoPath) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }
  return videoPath.slice(0, -4) + "-钩子.png";
};

/** 答案解释图路径（视频结尾答案解释，多页自动分张）：out/<期号>-答案-第N页.png */
export const getAnswerSheetPath = (videoPath, page) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }
  return videoPath.slice(0, -4) + `-答案-第${page}页.png`;
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

const generateSrt = (data, srtPath, opts = {}) => {
  // 用与视频渲染完全一致的 buildTimeline 推导时间轴，保证字幕与画面逐帧对齐
  const timeline = buildTimeline(data);
  const { fps, introFrames, hookFrames, outroFrames, slots, totalFrames } = timeline;
  const sec = (frames) => frames / fps;

  const blocks = [];
  let idx = 1;

  // 开场标题字幕：经典模板取片头段，快闪模板取钩子开场段（零片头/零钩子时不生成空字幕块）
  const introTitle = data.intro?.title?.replace(/\n/g, "，") ?? "";
  const leadFrames = hookFrames > 0 ? hookFrames : introFrames;
  if (introTitle && leadFrames > 0) {
    blocks.push(
      `${idx}`,
      `00:00:00,000 --> ${formatSrtTime(sec(leadFrames))}`,
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
      const punchline = q.punchline ?? "";
      const revealDur = end - stemEnd;
      // 爆款快闪模式：每题只出 2 条字幕（题干 / 正确答案），
      // 真相一句只出现在画面、不进字幕（字幕条数与题数成对，且与画面严格对齐）
      const burst = data.timing?.pacing === "burst";

      if (punchline && !burst) {
        // 经典模式：按字数比例拆分揭晓时长：答案与真相各占一段，避免一条长文本朗读溢出压到下一题
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

  // 片尾钩子字幕：默认输出（供剪映 TTS 口播钩子；画面不渲染钩子，钩子图由用户自行导入）；
  // 不需要口播钩子时用 --no-outro-hook 关闭（有 outro.hook 才输出）
  const hook = opts.outroHookSrt ? data.outro?.hook : undefined;
  if (hook) {
    const minimalOutro =
      data.timing?.pacing === "burst" && data.timing.minimalOutro !== false;
    const hookStartSec = sec(totalFrames - outroFrames);
    if (minimalOutro) {
      // 极简片尾（无片尾帧）：钩子口播从视频结束点开始（约 4.5 字/秒 + 缓冲），
      // 用户在剪映里延长视频（接钩子图/答案图）时自然对齐
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
  const {
    dataPath = "src/data/questions.json",
    srtOnly = false,
    composition = "LiteratureQuiz",
    hookImage = true,
    answerSheet = true,
    /** 片尾钩子口播字幕：默认输出（画面不渲染钩子）；false 时去掉 SRT 片尾钩子段 */
    outroHookSrt = true,
  } = options;
  // 渲染合成可切换：经典模板 LiteratureQuiz / 爆款快闪模板 BurstQuiz
  const compositionId = composition;

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
  const hookImagePath = getHookImagePath(videoPath);

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

      // 2. 渲染封面：快闪模板有钩子开场时取钩子画面（中点帧），
      //    零片头时取第 1 秒（题目呈现中，对标封面=首帧题目）；
      //    经典模板取第 3 秒（片头标题处）
      const coverTimeline = buildTimeline(data);
      const coverFrame =
        compositionId === "BurstQuiz"
          ? coverTimeline.hookFrames > 0
            ? Math.round(coverTimeline.hookFrames / 2)
            : 30
          : 90;
      runRemotion([
        "remotion",
        "still",
        compositionId,
        coverPath,
        `--props=${propsPath}`,
        `--frame=${coverFrame}`,
      ]);
      console.log(`封面      →  ${coverPath}`);

      // 3. 渲染片尾钩子图（outro.hook 文案大字图，发布配图/评论区置顶图）
      if (hookImage) {
        runRemotion([
          "remotion",
          "still",
          "OutroHook",
          hookImagePath,
          `--props=${propsPath}`,
          "--frame=0",
        ]);
        console.log(`钩子图    →  ${hookImagePath}`);
      }

      // 4. 渲染答案解释图（题号+题干+答案+解释，自动分页，每页一张）
      if (answerSheet) {
        const answerPages = computeAnswerPages(data.questions);
        for (let i = 0; i < answerPages.length; i++) {
          const pagePropsPath = propsPath.replace(
            ".json",
            `-answer-${i}.json`
          );
          fs.writeFileSync(
            pagePropsPath,
            JSON.stringify({ data, pageIndex: i }),
            "utf-8"
          );
          const sheetPath = getAnswerSheetPath(videoPath, i + 1);
          runRemotion([
            "remotion",
            "still",
            "AnswerSheet",
            sheetPath,
            `--props=${pagePropsPath}`,
            "--frame=0",
          ]);
          console.log(`答案图    →  ${sheetPath}`);
          fs.rmSync(pagePropsPath, { force: true });
        }
      }
    } finally {
      fs.rmSync(propsPath, { force: true });
    }
  }

  // 5. 生成字幕 + 发布文案
  generateSrt(data, srtPath, { outroHookSrt });
  generatePublishText(data, publishTextPath);

  return {
    videoPath,
    coverPath,
    srtPath,
    publishTextPath,
    hookImagePath,
    answerSheetPaths: answerSheet
      ? computeAnswerPages(data.questions).map((_, i) =>
          getAnswerSheetPath(videoPath, i + 1)
        )
      : [],
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
    composition: "LiteratureQuiz",
    hookImage: true,
    answerSheet: true,
    outroHookSrt: true,
  };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--data=")) {
      opts.dataPath = arg.slice("--data=".length);
    } else if (arg.startsWith("--composition=")) {
      opts.composition = arg.slice("--composition=".length);
    } else if (arg === "--srt-only") {
      opts.srtOnly = true;
    } else if (arg === "--no-hook-image") {
      opts.hookImage = false;
    } else if (arg === "--no-answer-sheet") {
      opts.answerSheet = false;
    } else if (arg === "--no-outro-hook") {
      opts.outroHookSrt = false;
    } else if (arg && !arg.startsWith("--")) {
      opts.videoPath = arg;
    }
  }
  return opts;
};

if (isDirectExecution(process.argv[1], import.meta.url)) {
  try {
    const { videoPath, dataPath, srtOnly, composition, hookImage, answerSheet, outroHookSrt } =
      parseCliArgs(process.argv);
    const result = renderVideoWithCover(videoPath, {
      dataPath,
      srtOnly,
      composition,
      hookImage,
      answerSheet,
      outroHookSrt,
    });
    console.log("\n✅ 全部完成：");
    console.log(`  视频: ${result.videoPath}`);
    console.log(`  封面: ${result.coverPath}`);
    console.log(`  字幕: ${result.srtPath}`);
    console.log(`  发布文案: ${result.publishTextPath}  (视频号 + 抖音)`);
    if (hookImage) console.log(`  钩子图: ${result.hookImagePath}`);
    for (const p of result.answerSheetPaths) console.log(`  答案图: ${p}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
