---
name: douyin-competitor-video
description: 扒抖音对标视频做竞品分析或提取文案。当用户发抖音/西瓜/头条视频链接、要「分析这条视频」「扒对标视频」「把视频文案/字幕拿下来」「拆解爆款文案结构」「看看这类内容值不值得做」时使用。只做数据分析（标题/点赞/评论/收藏/转发/章节要点/评论区）用 huashu-chrome 抓详情 API；要逐句文案则再走「下载视频 → whisper 本地转写 → 校正文言文错字」。适用于抖音系站点（douyin.com / iesdouyin / v.douyin 短链）。
---

# 扒抖音对标视频（竞品分析 + 提取文案）

把一条抖音视频拆成「数据 + 内容 + 文案」三样东西，供竞品分析、选题判断、文案拆解使用。

核心认知：**抖音网页版所有信息都藏在 `/aweme/v1/web/aweme/detail` 这个 JSON 里**——标题、精确数据、章节要点、视频下载直链、有无字幕，一次抓全。不要靠读页面文本，字段名和数字会丢。

## 一、什么时候用（诉求判断）

| 用户诉求 | 走哪条流程 | 产出 | 耗时 |
|---|---|---|---|
| 分析这条视频火不火、值不值得做 | 流程 A | 数据 + 结构拆解 | 几分钟 |
| 把文案/字幕拿下来 | 流程 B | 视频文件 + 逐句文案 | 10 分钟级 |
| 两者都要 | A + B | 全部 | 同上 |

## 二、前置依赖（首次一次性准备）

1. **huashu-chrome MCP**（带用户真实登录态，抓链接 + 下载视频）。先 `mcp_load huashu-chrome`。
2. **本地 ffmpeg**（提取音频，`brew install ffmpeg`）。
3. **faster-whisper 虚拟环境**（转写），项目根目录执行一次：

   ```bash
   python3 -m venv .venv-asr
   .venv-asr/bin/pip install --no-cache-dir faster-whisper
   ```

   ⚠️ pip 下载慢时前台会超时，改用**后台 job** 跑这一条即可（不限时）。

## 三、流程 A：竞品数据分析（快）

1. `mcp_load huashu-chrome`；可选 `learnings {domain:"douyin.com"}` 查历史经验。
2. `tabs` 开新标签 → `navigate` 打开短链，自动重定向到 `douyin.com/video/<aweme_id>`。
3. `network`（**必须带 `reload:true`**，否则无捕获）列出请求，定位 `aweme/v1/web/aweme/detail`。
4. `network {body:"aweme/v1/web/aweme/detail"}` 取响应，解析关键字段（见第六节）。
5. `read_text` 抓正文 + 高赞评论（看受众真实反应、二次创作方向）。
6. 输出：数据面（赞/评/藏/转 + 赞粉比 + 收藏率）+ 内容面（钩子结构、章节、结论）。

## 四、流程 B：提取逐句文案

1. 先走流程 A 拿到详情 JSON。
2. **看 `is_subtitled` 字段**：
   - `1`：有字幕轨道，从播放器字幕或字幕接口取（少见）。
   - `0`：**无字幕，必须「下载视频 + ASR」**，别浪费时间找字幕接口。
3. 从 `video.bit_rate[]` 选下载直链：
   - 优先 `format:"mp4"`（完整单文件）；`format:"dash"` 是音视频分片，需合并，跳过。
   - 优先 **720p**：它的音频码率 128k，比 1080p 的 64k 更适合 ASR。
   - 取该档 `play_addr.url_list[0]`。
4. `huashu-chrome download {url, savePath}` 下载（走浏览器，带 cookie/Referer，不会 403）。
5. 提取音频：

   ```bash
   ffmpeg -y -v error -i <视频.mp4> -vn -ac 1 -ar 16000 <音频.wav>
   ```

6. 转写（脚本已内置 `HF_HOME` 自动落到项目 `.hf-cache`，无需手动加）：

   ```bash
   .venv-asr/bin/python .agents/skills/douyin-competitor-video/scripts/transcribe-video.py <音频.wav> small
   ```

   - 首次会下载模型（small 约 466MB），耐心等几分钟。
   - 文言文/生僻字多的内容用 `medium`（更准，慢 3-5 倍）。
7. **校对（必须）**：small/medium 对文言文、成语、生僻字常出同音错字（如「庖丁解牛」→「陶鼎解牛」、「游刃有余」→「犹然犹鱼」、「栋梁」→「冻粮」）。交付前逐句过一遍，附校对清单。
8. 输出：视频 + `ASR原始.txt/.md` + `校正版.md`（分段 + 错字修正 + 角色标注）。

## 五、关键接口与字段速查（aweme/detail）

| 诉求 | 字段 | 说明 |
|---|---|---|
| 完整标题 | `desc` | 含话题标签 |
| 精确数据 | `statistics.digg_count` / `comment_count` / `collect_count` / `share_count` | 点赞/评论/收藏/转发 |
| 账号 | `author.nickname` / `follower_count` / `signature` | 昵称/粉丝/简介 |
| 时长 | `duration` | 毫秒（÷1000 得秒） |
| 有无字幕 | `is_subtitled` | `0` 无 / `1` 有 |
| 章节要点 | `chapter_list[]` | `{desc, detail, timestamp}`，AI 生成的分段摘要 |
| 视频直链 | `video.bit_rate[].play_addr.url_list[]` | `format:"mp4"`=完整文件，`"dash"`=分片 |
| AI 标记 | `risk_infos` | `type:47` = 「疑似 AI 生成」提示 |
| 背景音乐 | `music.play_url.url_list[]` | 独立 mp3 |

## 六、踩坑清单（先读，都是实测血泪）

1. **内置浏览器 `browser_*` 可能报 `no usable browser provider`** → 改用 huashu-chrome MCP。
2. **`web_fetch` 抓 v.douyin 短链报 cross-origin redirect** → 用 huashu-chrome `navigate` 让浏览器自己重定向。
3. **`network` 初次无捕获** → 必须加 `reload:true`。
4. **`is_subtitled:0` 时别找字幕接口** → 直接下载 + ASR。
5. **下载选 720p mp4，别选 1080p/dash** → 音频码率更高、单文件更省事。
6. **pip 装 faster-whisper 前台超时** → 改后台 job。
7. **HF 模型缓存默认写 `~/.cache/huggingface` 被沙箱拒绝** → 脚本已内置自动落到 `cwd/.hf-cache`。
8. **small 模型文言文同音错字多** → 转写后必须人工校对。
9. **`.hf-cache/`、`.venv-asr/` 要进 `.gitignore`** → 别把 466MB 模型误提交。

## 七、输出规范

- 文件统一放 `out/`，命名 `ref-<主题>.mp4` / `ref-<主题>-完整文案-*.md|txt`。
- 交付至少给：数据面结论 + 章节骨架 + 校正版文案。
- 提醒用户：文案仅用于研究结构/选题/话术，**不可照搬发布**（版权/搬运风险）。
