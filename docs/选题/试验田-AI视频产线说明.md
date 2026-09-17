# 试验田 · AI 视频产线说明

> 用途：把「成语故事」「镇馆之宝」这类**讲述型**内容做成 AI 视频（画面动起来），
> 区别于答题快闪线（Remotion BurstQuiz）。两者共用 MiniMax 配音与发布工具链。
> 建立日期：2026-09-17

---

## 一、产线总览

```
① 脚本 JSON          src/data/dialogue/story-0X.json        （分段：角色 / 旁白文本 / 插画路径）
② AI 生图（无字画面）  AI 生图工具 → out/storyXX/<段名>.png
③ AI 视频（可选）      即梦网页版 或 scripts/story/animate-story.py（海螺 API）
④ 配音 + 字幕         scripts/dialogue/gen-minimax-tts.py   （MiniMax t2a_v2，增量缓存）
⑤ 合成成片            scripts/dialogue/compose-video.py     （两段式，见第四节）
⑥ 封面 / 发布文案      手工做 3:4 封面 + out/故事集-第0X集.txt
```

**红线（不可省）**：AI 画面一律不带文字；发布必勾「含AI生成内容 / 内容由AI生成」；
考据注明出处；对标内容只复用结构与选题，文案逐句重写；不克隆名人声线。

---

## 二、脚本 JSON 约定

沿用「国学对谈」的对白结构，复用现成管线（`scripts/dialogue/*`）：

| 字段 | 说明 |
|---|---|
| `label` | 期号标签，决定输出文件名（如 `成语故事-第01集`） |
| `voices` | 每段一个「角色」，讲述型全部用同一音色（`audiobook_male_1`） |
| `portraits` | 角色 → 插画/视频片段路径（**这是复用的关键**：一段一图/一段一片） |
| `speeds` | 讲述型统一 1.05~1.15（压时长以塞进画面窗口） |
| `lines[]` | `{role, text}`，一行一段，与画面一一对应 |

---

## 三、AI 视频生成：两条路

### 1. 即梦网页版（试水用，实测参数）

| 项 | 值 |
|---|---|
| 模式 | 全能参考（多图串联）；单段可用单图 |
| 模型 | 即梦 Seedance 2.0 mini（最省；选 15s 档会自动切 Fast VIP 通道） |
| 比例/清晰度 | 9:16 / 720P |
| 时长档 | 5s / 10s / 15s |
| 实测成本 | 2.5 模型 5s ≈ 100 积分；mini 10s ≈ 60 积分；15s（Fast VIP）≈ 90 积分 |
| 提示词写法 | `从 @图片1 的…开始，镜头缓慢平移运镜，自然过渡到 @图片2 的…，保持统一画风，画面连贯如长镜头` |

**已知特性**：多图串联时模型自行分配每张图的停留时长（实测 10s 三图 = 3/4/3s），
**不可控**——所以只能用于「声音迁就画面」或段内多镜头，不能用来卡旁白。

### 2. 海螺 API（批量用，额度受限）

`scripts/story/animate-story.py`

```bash
.venv-asr/bin/python scripts/story/animate-story.py --data=src/data/dialogue/story-02.json
```

- 逐段提交 `POST /v1/video_generation`（`first_frame_image` 传 dataURI）→ 轮询 `query/video_generation`
  → `files/retrieve` 下载到 `out/storyXX/clips/<段名>.mp4`
- 断点续跑（已存在且 ≥5.5s 的片段跳过）；额度不足（2052/2056）立即停，不白烧请求
- ⚠️ 当前 MiniMax Token Plan **不含视频额度**，跑之前先确认套餐覆盖视频生成

---

## 四、合成：两段式（重要，踩过坑）

`compose-video.py` 早期用单条 `filter_complex`（concat 视频 + 多输入 amix 音频）合成，
出现**非确定性截断**：同一条命令 bash 直跑正常、Python subprocess 里音频随机只剩第一段（约 5s）。

现改为两段式，三步各自原子：

1. 图片序列 → 纯视频 mp4（`-loop 1 -t` + concat）
2. mp3 + BGM → 混音 wav（`amix duration=longest` → `loudnorm` → 与 BGM 再混）
3. `-c:v copy` 合流（视频不重编码）

**验收标准**：`ffprobe` 音视频时长都 ≈ 总时长；分段 `volumedetect` 每个窗口都有输出。

---

## 五、音画对轨的两种模式

| | 画面迁就声音（主产线） | 声音迁就画面 |
|---|---|---|
| 顺序 | 先写旁白 → 按旁白时长生成画面 | 先生成画面 → 量场景窗口 → 按窗口写旁白 |
| 旁白自由度 | 完整（8~15s 讲透） | 被窗口卡死（一句两句） |
| 适用 | 每集 5~8 段的串烧型正片 | 运镜长镜头、单成语深挖的段落 |
| 实现 | `gen-minimax-tts.py` 出时间轴 → 合成器按时长切图 | 抽帧量窗口 → `adelay` 对齐 → 字幕 PNG `overlay enable=between(t,…)` |

---

## 六、已完成产物（归档）

| 产物 | 说明 |
|---|---|
| `out/成语故事-第01集-成片.mp4` | 6 个寓言成语（插图版），78s |
| `out/成语故事-第02集-成片.mp4` | 6 个动物成语（插图版），92s |
| `out/story02/clips/运镜三连-2.0mini试片.mp4` | 3 图运镜串联验证（10s / 60 积分） |
| `out/story02/clips/运镜三连-配音演示.mp4` | 「声音迁就画面」完整演示（含字幕+BGM） |
| `out/museum01/博物馆镇馆之宝-试片01.mp4` | 镇馆之宝首测：骨笛→勾践剑→铜奔马，15s 长镜头 + 配音字幕 |

> 上述成片与插画落在 `out/`（gitignored），提示词与脚本 JSON 在库内可复现。
