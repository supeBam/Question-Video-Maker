// 一键导出第 12 / 13 期「成语典故·主角都是谁」快闪视频
// 用法（在项目根目录执行）：
//   node scripts/export-260906.mjs
//
// 输出（均落在 out/ 下）：
//   成语-第12期.mp4 / .png（封面）/ -钩子.png（钩子图）/ .srt（字幕）/ .txt（发布文案）
//   成语-第13期.mp4 / .png（封面）/ -钩子.png（钩子图）/ .srt（字幕）/ .txt（发布文案）
// 按需求不导出答案图（answerSheet: false）。

import { renderVideoWithCover } from "./render-with-cover.mjs";

const EPISODES = [
  {
    videoPath: "out/成语-第12期.mp4",
    dataPath: "src/data/questions-260906-1.json",
  },
  {
    videoPath: "out/成语-第13期.mp4",
    dataPath: "src/data/questions-260906-2.json",
  },
];

for (const ep of EPISODES) {
  console.log(`\n========== 导出 ${ep.videoPath} ==========`);
  const result = renderVideoWithCover(ep.videoPath, {
    dataPath: ep.dataPath,
    composition: "BurstQuiz", // 快闪模板
    hookImage: true, // 片尾钩子图（发布配图 / 评论区置顶图）
    answerSheet: false, // 不导出答案图
    outroHookSrt: true, // 片尾钩子口播字幕
  });
  console.log(`\n✅ 完成：${result.videoPath}`);
}

console.log("\n✅✅ 两期全部导出完成");
