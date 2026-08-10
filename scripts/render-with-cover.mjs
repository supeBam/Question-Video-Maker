import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const getCoverPath = (videoPath) => {
  if (path.extname(videoPath).toLowerCase() !== ".mp4") {
    throw new Error("视频输出路径必须使用 .mp4 扩展名");
  }

  return videoPath.slice(0, -4) + ".png";
};

const runRemotion = (args) => {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

export const renderVideoWithCover = (videoPath = "out/literature-quiz.mp4") => {
  const coverPath = getCoverPath(videoPath);

  runRemotion(["remotion", "render", "LiteratureQuiz", videoPath, "--log=error"]);
  runRemotion([
    "remotion",
    "still",
    "LiteratureQuiz",
    coverPath,
    "--frame=90",
  ]);

  return { videoPath, coverPath };
};

export const isDirectExecution = (argvPath, moduleUrl) => {
  return Boolean(argvPath) && path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
};

if (isDirectExecution(process.argv[1], import.meta.url)) {
  try {
    renderVideoWithCover(process.argv[2]);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
