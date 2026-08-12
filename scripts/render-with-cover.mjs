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
  const { timing, questions } = data;
  const { fps, introSeconds, perQuestion } = timing;
  const presentSec = perQuestion.presentSeconds;
  const countdownSec = perQuestion.countdownSeconds;
  const revealSec = perQuestion.revealSeconds;
  const perQ = presentSec + countdownSec + revealSec;

  let cursor = introSeconds;
  const blocks = [];
  let idx = 1;

  for (const q of questions) {
    const stem = q.stem.replace(/\n/g, " ");
    const letter = LETTERS[q.answerIndex];
    const answerText = q.options[q.answerIndex];

    // 题干字幕（呈现 + 倒计时）
    const qStart = cursor;
    const qEnd = cursor + presentSec + countdownSec;
    blocks.push(
      `${idx}`,
      `${formatSrtTime(qStart)} --> ${formatSrtTime(qEnd)}`,
      stem,
      ""
    );
    idx++;

    // 答案字幕（揭晓阶段）
    const aStart = qEnd;
    const aEnd = cursor + perQ;
    blocks.push(
      `${idx}`,
      `${formatSrtTime(aStart)} --> ${formatSrtTime(aEnd)}`,
      `正确答案：${letter}. ${answerText}`,
      ""
    );
    idx++;

    cursor += perQ;
  }

  fs.writeFileSync(srtPath, blocks.join("\n"), "utf-8");
  console.log(`SRT 字幕  →  ${srtPath}  (${idx - 1} 条)`);
};

// ── main ──────────────────────────────────────────────────

export const renderVideoWithCover = (videoPath = "out/literature-quiz.mp4") => {
  const coverPath = getCoverPath(videoPath);
  const srtPath = getSrtPath(videoPath);

  // 1. 渲染视频
  runRemotion(["remotion", "render", "LiteratureQuiz", videoPath, "--log=error"]);
  console.log(`视频      →  ${videoPath}`);

  // 2. 渲染封面
  runRemotion(["remotion", "still", "LiteratureQuiz", coverPath, "--frame=90"]);
  console.log(`封面      →  ${coverPath}`);

  // 3. 生成字幕
  const questionsPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data",
    "questions.json"
  );
  const data = JSON.parse(fs.readFileSync(questionsPath, "utf-8"));
  generateSrt(data, srtPath);

  return { videoPath, coverPath, srtPath };
};

export const isDirectExecution = (argvPath, moduleUrl) => {
  return Boolean(argvPath) && path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
};

if (isDirectExecution(process.argv[1], import.meta.url)) {
  try {
    const result = renderVideoWithCover(process.argv[2]);
    console.log("\n✅ 全部完成：");
    console.log(`  视频: ${result.videoPath}`);
    console.log(`  封面: ${result.coverPath}`);
    console.log(`  字幕: ${result.srtPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
