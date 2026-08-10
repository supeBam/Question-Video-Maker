import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  getCoverPath,
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

test("Windows 文件 URL 能识别为直接执行", () => {
  const scriptPath = path.resolve("scripts/render-with-cover.mjs");
  assert.equal(isDirectExecution(scriptPath, pathToFileURL(scriptPath).href), true);
});
