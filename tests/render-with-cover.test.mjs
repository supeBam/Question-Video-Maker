import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  getCoverPath,
  getPublishTextPath,
  derivePublish,
  isDirectExecution,
} from "../scripts/quiz/render-with-cover.mjs";

test("封面与 MP4 同路径同名", () => {
  assert.equal(
    getCoverPath("out/中国朝代历史-第02期.mp4"),
    "out/中国朝代历史-第02期.png"
  );
});

test("拒绝非 MP4 输出路径", () => {
  assert.throws(() => getCoverPath("out/video.mov"), /\.mp4/);
});

test("发布文案为单个 txt 文件", () => {
  assert.equal(
    getPublishTextPath("out/中国朝代历史-第02期.mp4"),
    "out/中国朝代历史-第02期.txt"
  );
});

test("抖音标题取首行短钩子，并追加流量标签", () => {
  const data = {
    meta: { series: "中国文化冷知识" },
    intro: { title: "这4位大诗人\n诗里一套、背后一套" },
  };
  const { title, hashtags } = derivePublish(data, "douyin");
  assert.equal(title, "这4位大诗人");
  assert.ok(hashtags.includes("#古诗词"));
  assert.ok(hashtags.includes("#涨知识"));
});

test("视频号标题用完整文案，不加流量标签", () => {
  const data = {
    meta: { series: "中国文化冷知识" },
    intro: { title: "这4位大诗人\n诗里一套、背后一套" },
  };
  const { title, hashtags } = derivePublish(data, "wechat");
  assert.equal(title, "这4位大诗人 诗里一套、背后一套");
  assert.ok(hashtags.includes("#古诗词"));
  assert.ok(!hashtags.includes("#涨知识"));
});

test("publish 可按平台覆盖标题与话题", () => {
  const data = {
    meta: { series: "中国文化冷知识" },
    intro: { title: "默认标题" },
    publish: {
      douyin: { title: "抖音标题", hashtags: ["#抖音"] },
      wechat: { title: "视频号标题", hashtags: ["#视频号"] },
    },
  };
  assert.equal(derivePublish(data, "douyin").title, "抖音标题");
  assert.deepEqual(derivePublish(data, "douyin").hashtags, ["#抖音"]);
  assert.equal(derivePublish(data, "wechat").title, "视频号标题");
  assert.deepEqual(derivePublish(data, "wechat").hashtags, ["#视频号"]);
});

test("万物雅称栏目映射专属话题", () => {
  const data = {
    meta: { series: "万物雅称" },
    intro: { title: "古人的诗意外号\n美到可以直接当名字" },
  };
  const { title, hashtags } = derivePublish(data, "douyin");
  assert.equal(title, "古人的诗意外号");
  assert.ok(hashtags.includes("#万物雅称"));
  assert.ok(hashtags.includes("#涨知识"));
});

test("抖音话题最多 5 个（超出即截断）", () => {
  const data = {
    meta: { series: "成语" },
    intro: { title: "标题" },
    publish: {
      hashtags: ["成语", "成语故事", "涨知识", "冷知识", "传统文化", "中国文化"],
    },
  };
  const { hashtags } = derivePublish(data, "douyin");
  assert.ok(
    hashtags.length <= 5,
    `实际 ${hashtags.length} 个：${hashtags.join(" ")}`
  );
  assert.equal(hashtags.length, 5);
});

test("抖音话题即使 publish 覆盖也强制 ≤5", () => {
  const data = {
    meta: { series: "成语" },
    intro: { title: "标题" },
    publish: {
      douyin: { hashtags: ["a", "b", "c", "d", "e", "f", "g"] },
    },
  };
  const { hashtags } = derivePublish(data, "douyin");
  assert.equal(hashtags.length, 5);
});

test("Windows 文件 URL 能识别为直接执行", () => {
  const scriptPath = path.resolve("scripts/quiz/render-with-cover.mjs");
  assert.equal(isDirectExecution(scriptPath, pathToFileURL(scriptPath).href), true);
});

// 注：--compose-tts 一键出片端到端验证放在 4 步跑一次真渲染（需 .venv-asr + ffprobe + Remotion）
// 这里 单元测试只覆盖纯函数（路径、标题、话题），整合由 E2E 覆盖。
