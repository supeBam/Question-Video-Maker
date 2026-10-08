---
name: one-click-publish
description: 半自动一键发布（视频号 + 抖音）。当用户说「发布这条」「把 out/ 成片发到两个平台」「一键发布」「开始发布」「填好我去点发布」时使用。用 huashu-chrome 操控视频号助手 / 抖音创作者中心网页后台，自动投成片、自动选封面、自动填标题描述话题与 AI 声明，只把「点发布」这一下留给人。
---

# 一键发布助手（半自动 · 只填不发）

> 全流程 2026-09-10 本机实测：视频号（41.8MB 成片 + 封面 + 4 话题 + AI 标注全部填成）、
> 抖音（上传、30 字标题硬限、话题回车、自主声明、竖封面裁剪，全部走通）。
> 站点结构若改版，先 `learnings` 复核，再把差异写回 learnings。

## 0. 三条铁律

1. **永不点「发表 / 发布」**。最后那一下必须用户自己点（用 `ask` 交还控制权）。
   理由：两平台对网页批量上传都有风控，AI 内容群发容易判营销号 → 限流封号。
2. **AI 生成声明必选**：视频号「视频标注 → 含AI生成内容」/ 抖音「自主声明 → 内容由AI生成」。漏了是合规问题。
3. **一步一看效果证据**。页面报「超限 / 不合规 / 没反应」就停下报告，同一条命令不要重试第二次。

## 1. 先出清单（不碰浏览器）

```bash
npm run publish:prepare -- "out/<期号>.mp4" --data=src/data/questions-xxxx-x.json
# 或取 out/ 下最新成片：
npm run publish:prepare -- --latest
```

产出 `out/<期号>-publish.json`；`platforms.<平台>.fields` 是**已按平台规则切好**的待填文本
（抖音标题 30 字硬限会自动在句读处断、后半句并入简介，切走的内容记在 `movedFromTitle`）。

- 终端有 `❌` 或清单 `blocking` 非空 → 先改文案重跑，别去后台。
- 只有 `⚠️` → 可以继续，但要口头提一句让用户核对。

## 2. 扩展体检（只在报错时做）

`upload` 报 `atob 解码失败…类型=undefined` = Chrome 里跑着旧扩展代码。
**调一次 huashu-chrome 的 `reload` 工具**（约 2 秒自动重连）即可，不要改方案、不要换工具。

本任务同时开两个后台，**每条浏览器命令都必须显式带 `tabId`**（缺省槽整个会话共用，会被改写）。

## 3. 视频号（channels.weixin.qq.com）

结构：外壳 `/platform/post/create` 把应用挂在**同源子应用 iframe**（`/micro/content/post/create`）里。
描述框、短标题框、上传 input、标注下拉全在 iframe 内 —— 快照里的元素只是镜像，
`type` / `click` 会报「被其它元素遮挡」。**写操作一律 `eval` 进 iframe**；文件要靠页内中继。

| 步 | 动作 | 成功证据 |
|----|------|----------|
| 3.1 | `tabs(action:"new", url:"https://channels.weixin.qq.com/platform/post/create", label:"发布-视频号")`，记下 tabId | 页面标题「视频号助手」 |
| 3.2 | 若只有导航没有表单：`eval` 点 iframe 里文本为「发表视频」的 button | 出现「添加描述 / 短标题 / 发表」 |
| 3.3 | 读 `.agents/skills/one-click-publish/assets/relay.js` 全文，原样 `eval` | 返回 `{"installed":true,"videoInputNow":true}` |
| 3.4 | `upload(path=<成片绝对路径>, selector:"#__hcRelay_video", tabId)` | 「已投入 xxx（41.8MB）」 |
| 3.5 | `wait(for:"text", value="视频描述", timeout:90000)`（大文件解析要时间） | 表单出现 |
| 3.6 | 读 `.agents/skills/one-click-publish/assets/fill-wechat.js`，把 `__CAPTION__` / `__TITLE__` 换成清单字段（用 `JSON.stringify` 的带引号字面量），`eval` | 返回 `ok:true`，`topics` 数量 = 清单话题数，`aiLabel:"含AI生成内容"` |
| 3.7 | 封面：`eval` 点文本「编辑」的封面按钮 → `upload(path=<封面>, selector:"#__hcRelay_image", tabId)` → `eval` 点裁剪区的「确认」（`.weui-desktop-btn_primary`，文本===确认） | 封面区由「选择封面」变「编辑封面」；9:16 会被裁成 3:4，**要提醒人看一眼** |
| 3.8 | 交还：`ask(prompt="视频号这条已填好（描述+4话题 / 短标题 / 含AI生成内容 / 封面）。请核对后自己点「发表」；要定时就选「定时」定在早6点或晚6点。我不点发布。", tabId=<视频号tabId>)` | 用户点完发表 |

fill-wechat.js 已把「描述 + 短标题 + AI 标注」三步合在一条 eval 里（省两个模型回合），
它内部用的就是这三条选择器：

```
描述    .input-editor[data-placeholder="添加描述"]   ← focus + Range 收到末尾 + execCommand('insertText')
短标题  input.weui-desktop-form__input[placeholder^="填写短标题"]  ← 原生 value setter + input 事件
AI 标注 .post-with-mark-tag .select-display → .mark-tag-option(含AI生成内容) → .select-value 读回
```

⚠️ 视频号会**默认带上本机位置**（实测「广州市」）。要清位置就在 3.6 之后 `eval` 找 `.form-item` 里含「位置」的那行点掉清除图标，
或者在交还时提醒用户自己点掉。

## 4. 抖音（creator.douyin.com）

结构：表单在**顶层文档**，`snapshot` / `type` / `upload` 直接可用，**不需要中继**。

| 步 | 动作 | 成功证据 |
|----|------|----------|
| 4.1 | `tabs(action:"new", url:"https://creator.douyin.com/creator-micro/content/upload", label:"发布-抖音")` | 「发布高清视频 / 上传视频」 |
| 4.2 | 若出现「你还有上次未发布的视频，是否继续编辑？继续编辑 / 放弃」→ **问用户**要接着哪条，别擅自顶掉草稿 | — |
| 4.3 | `upload(path=<成片绝对路径>, tabId)` | 「已投入 …」 |
| 4.4 | `wait(for:"text", value="作品描述", timeout:90000)`，页面跳到 `/content/post/video` | 表单出现 |
| 4.5 | `snapshot` 拿引用：标题框 placeholder「填写作品标题…」；简介框「添加作品简介」 | refs |
| 4.6 | `type(标题框, fields["作品标题"])` —— **30 字硬限**，超了平台静默截断 | 效果行 value 变化、`作品描述 N/30` |
| 4.7 | `type(简介框, fields["作品简介"])`（单独一次调用：`act` 批量会把它当提交类控件拦下） | 简介有值 |
| 4.8 | 话题成块：简介里每个 `#词` 必须补一次 `key("Enter")` 才变话题块。做法：逐个 `type("#词", clear:false)` → `key("Enter")` → `snapshot` 核对话题块文本 | 话题块数 = 清单话题数，且文本与清单一致 |
| 4.9 | AI 声明：`query(contains:"自主声明")` 找「请选择自主声明」的 div → `act click selector` → 选项点 `内容由AI生成`（label 内 span）→ **单独一次** `click` 「确定」 | 表单区显示「自主声明 内容由AI生成」 |
| 4.10 | 封面：`query(contains:"选择封面")` 拿竖封面块矩形 → `click(x,y)` 用矩形中心坐标（这控件没有语义角色）→ 浮层里 `upload(path=<封面>, selector:"input[type=file][accept*='image']")` → `click` 保存 → `click` 完成 → 若追问横封面点「暂不设置」 | 「已基于竖封面为你生成横封面」 |
| 4.11 | 交还：`ask(prompt="抖音这条填好了（标题/简介/话题/内容由AI生成/竖封面）。请核对后自己点「发布」，想错开时间就选「定时发布」。")` | 用户点完发布 |

话题回车有坑：候选首位可能是**更热的近似词**（实测输 `#知行合一` 候选里有 `#知行合一王阳明`）。
回车后一定核对话题块文本；不一致就删掉重打或改用 `#添加话题` 面板手选，并把偏差报给用户。

## 5. 收尾

- 报清单：期号、两个 tabId、各自实际填入的标题 / 话题数 / AI 声明值、清单文件路径。
- 用户说「发了」→ 提醒 `docs/发布台账.md`（周复盘时由 `scripts/analytics/build-ledger.mjs` 从平台导出表自动登记，这里只需口头确认时间与平台）。
- 新摸到的改名 / 新弹窗 / 风控提示 → 写回 `learnings({domain, save})`（两个域分别存）。

## 6. 实测过的坑（别重复试）

| 现象 | 真相 / 处置 |
|------|-------------|
| `upload` 报 `atob 解码失败…类型=undefined` | 扩展代码旧了 → `reload` 工具一次 |
| 视频号 `type` 描述框「被其它元素遮挡」 | 快照元素是镜像，真节点在同源 iframe → 走 eval |
| 视频号 `upload` 回「已把 x.mp4 拖放到 body.__finder-page」 | 没装中继（iframe 里挑不到 input）→ 先跑 relay.js，再 `selector:"#__hcRelay_video"` |
| 从 https 页面 `fetch http://127.0.0.1` 投喂文件 | Chrome 本地网络访问策略把 fetch/XHR/WS/img 全拦 → 只能走中继（`scripts/publish/serve-out.mjs` 这条路已废弃删除） |
| 直连子应用 URL `…/micro/content/post/create` | 返回 `Cannot GET`；子应用只能由外壳挂载 |
| 抖音标题少了尾巴几个字 | 30 字硬截断（toast「标题内容仅支持30个字符」）→ 用清单切好的标题 |
| 抖音 `act` 里填简介被拦 | 工具把「添加作品简介」当提交类控件 → 单独 `type` |
| 抖音话题只有 `#词` 纯文本 | 少了一次回车 → 补 `#词` + `Enter` 并核对话题块 |
| 抖音视频上传后 URL 变了 | 表单在 `/content/post/video?enter_from=publish_page`，不是原地展开 → 别按 upload 页找元素 |
| 命令没带 tabId | 缺省槽被另一条工作线改写，操作落到错误页面 |
| 误点左上导航 | 会直接跳出表单（抖音），得从首页「继续编辑」接回草稿 |
