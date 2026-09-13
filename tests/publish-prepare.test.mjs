import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePublishText,
  parseHashtags,
  resolveAssets,
  splitTitle,
  deriveShortTitle,
  buildManifest,
  PLATFORM_LIMITS,
} from "../scripts/publish/prepare.mjs";

// 答题线：出片脚本自动生成的紧凑格式（只有一个长标题）
const QUIZ_TXT = `【视频号】
标题：「笑面虎」出自哪本书？多数人都想错了，答对 8 个算你牛

话题：#成语 #成语故事 #冷知识 #传统文化 #中国文化

【抖音】
标题：「笑面虎」出自哪本书？多数人都想错了，10 题答对 8 个算你牛

话题：#成语 #成语故事 #冷知识 #传统文化 #中国文化
`;

// 对谈线：手工写的详细格式（短标题与描述分开）
const DIALOGUE_TXT = `# 国学对谈03 · 知行合一 —— 发布内容

## 大标题（封面大字，无标点）
知行合一 知道还是做到

## 视频号（短标题 + 描述 + 话题）

【短标题】知行合一 知道还是做到

【描述】懂了那么多道理，为什么还是过不好这一生？

【话题】#国学 #知行合一 #王阳明 #孔子

## 抖音（标题 + 描述 + 话题）

【标题】懂了那么多道理，为什么还是过不好这一生？

【描述】王阳明说知而不行只是未知。

【话题】#国学 #知行合一 #涨知识 #知识分享 #人生感悟
`;

const mkManifest = (blocks, over = {}) =>
  buildManifest({
    label: "测试期",
    videoPath: "out/测试期.mp4",
    coverPath: "out/测试期.png",
    publishTextPath: "out/测试期.txt",
    blocks,
    info: {},
    probe: { width: 1080, height: 1920, fps: 30, durationSec: 60 },
    sizes: { video: { bytes: 20 * 1024 * 1024 }, cover: { bytes: 1024 } },
    ...over,
  });

test("紧凑格式：两个平台都解析出标题与话题", () => {
  const b = parsePublishText(QUIZ_TXT);
  assert.equal(b.wechat.hashtags.length, 5);
  assert.match(b.wechat.title, /^「笑面虎」出自哪本书/);
  assert.match(b.douyin.title, /10 题答对 8 个算你牛$/);
});

test("详细格式：短标题 / 描述 / 话题各归各位", () => {
  const b = parsePublishText(DIALOGUE_TXT);
  assert.equal(b.wechat.title, "知行合一 知道还是做到");
  assert.equal(b.wechat.shortTitleGiven, true);
  assert.equal(b.wechat.description, "懂了那么多道理，为什么还是过不好这一生？");
  assert.equal(b.douyin.hashtags.length, 5);
});

test("话题：缺 # 自动补，词尾标点吃掉，「无」当没写", () => {
  assert.deepEqual(parseHashtags("成语，传统文化"), ["#成语", "#传统文化"]);
  assert.deepEqual(parseHashtags("#国学。 #知行合一"), ["#国学", "#知行合一"]);
  assert.deepEqual(parseHashtags("无"), []);
});

test("视频号：长标题自动另推短标题，但正文保留完整长文案", () => {
  const m = mkManifest(parsePublishText(QUIZ_TXT));
  const w = m.platforms.wechat;
  assert.equal(w.title, "笑面虎出自哪本书");
  assert.ok(w.captionFull.startsWith("「笑面虎」出自哪本书？多数人都想错了"), "正文不能被短标题顶掉");
  assert.ok(w.captionFull.endsWith("#成语 #成语故事 #冷知识 #传统文化 #中国文化"));
});

test("抖音：30 字硬限在句读处切，切走的半句进简介，一个字都不丢", () => {
  const m = mkManifest(parsePublishText(QUIZ_TXT));
  const d = m.platforms.douyin;
  assert.ok([...d.title].length <= 30, `标题 ${d.title} 仍超 30 字`);
  assert.equal(d.movedFromTitle, "10 题答对 8 个算你牛");
  assert.ok(d.captionFull.includes("10 题答对 8 个算你牛"), "切走的后半句必须落在简介里");
  const total = [...(d.title + d.movedFromTitle)].join("");
  assert.equal(total.replace(/\s/g, ""), "「笑面虎」出自哪本书？多数人都想错了10题答对8个算你牛");
});

test("抖音：话题 5 个封顶（平台硬限），清单只留前 5 个", () => {
  const b = parsePublishText(QUIZ_TXT);
  b.douyin.hashtags = ["#a", "#b", "#c", "#d", "#e", "#f"];
  const m = mkManifest(b);
  assert.equal(m.platforms.douyin.hashtags.length, PLATFORM_LIMITS.douyin.hashtagsMax);
});

test("正文超平台上限会进 blocking，清单退出码非 0 的依据", () => {
  const b = { wechat: { title: "短", description: "句".repeat(1200) }, douyin: { title: "短" } };
  const m = mkManifest(b);
  assert.ok(m.blocking.some((x) => x.startsWith("视频号")), "应报视频号正文超限");
});

test("splitTitle：无停顿的长句按字数硬切，短句原样返回", () => {
  assert.deepEqual(splitTitle("短标题", 30), { title: "短标题", moved: "" });
  const hard = splitTitle("一二三四五六七八九十".repeat(4), 30);
  assert.equal([...hard.title].length, 30);
  assert.equal([...(hard.title + hard.moved)].length, 40);
});

test("deriveShortTitle：取第一句并去标点，超长截断", () => {
  assert.equal(deriveShortTitle("「笑面虎」出自哪本书？多数人都想错了", 16), "笑面虎出自哪本书");
  assert.equal([...deriveShortTitle("无标点到底", 2)].length, 2);
});

test("素材命名约定：答题线同名 / 对谈线带前后缀都能自动配对", () => {
  // 用假 exists 模拟磁盘，避免测试依赖 out/ 里的真实产物
  const make = (present) => (p) => present.some((x) => p.endsWith(x));
  const quiz = resolveAssets(
    "/abs/out/成语-第17期.mp4",
    "/abs",
    make(["成语-第17期.png", "成语-第17期.txt"]),
  );
  assert.deepEqual(quiz, { cover: "out/成语-第17期.png", publishText: "out/成语-第17期.txt" });

  const dlg = resolveAssets(
    "/abs/out/国学对谈03-成片.mp4",
    "/abs",
    make(["封面-国学对谈03.png", "发布内容-国学对谈03.txt"]),
  );
  assert.deepEqual(dlg, {
    cover: "out/封面-国学对谈03.png",
    publishText: "out/发布内容-国学对谈03.txt",
  });

  // 什么都没有时不编造路径
  assert.deepEqual(resolveAssets("/abs/out/x.mp4", "/abs", () => false), {
    cover: null,
    publishText: null,
  });
});
