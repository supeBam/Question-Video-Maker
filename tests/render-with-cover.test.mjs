import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  getCoverPath,
  getPublishTextPath,
  derivePublish,
  isDirectExecution,
} from "../scripts/render-with-cover.mjs";

test("封面与 MP4 同路径同名", () => {
  assert.equal(
    getCoverPath("out/中国朝代历史-第02期.mp4"),
    "out/中国朝代历史-第02期.png"
  );
});

test("拒绝非 MP4 输出路径", () => {
  assert.throws(() => getCoverPath("out/video.mov"), /\.mp4/);
});

test("抖音/视频号发布文案路径", () => {
  assert.equal(
    getPublishTextPath("out/中国朝代历史-第02期.mp4", "douyin"),
    "out/中国朝代历史-第02期.抖音.txt"
  );
  assert.equal(
    getPublishTextPath("out/中国朝代历史-第02期.mp4", "wechat"),
    "out/中国朝代历史-第02期.视频号.txt"
  );
});

test("未知发布平台报错", () => {
  assert.throws(() => getPublishTextPath("out/v.mp4", "xiaohongshu"), /平台/);
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

test("Windows 文件 URL 能识别为直接执行", () => {
  const scriptPath = path.resolve("scripts/render-with-cover.mjs");
  assert.equal(isDirectExecution(scriptPath, pathToFileURL(scriptPath).href), true);
});
