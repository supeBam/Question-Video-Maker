(() => {
  /**
   * 视频号助手 · 一次填完「视频描述 + 短标题 + 含AI生成内容标注」
   *
   * 用法（huashu-chrome 的 eval）：
   *   把下面两处占位符换成发布清单里的字符串（建议用 JSON.stringify 结果，自带引号与转义）：
   *     CAPTION ← platforms.wechat.fields["视频描述"]   （正文，话题已拼在末尾）
   *     TITLE   ← platforms.wechat.fields["短标题"]
   *   前置：已 eval 装好 relay.js，且成片已投入并解析完（描述框与标注行都在成片出现后才会有）。
   *
   * 返回一段 JSON 作为这一步的效果证据；missing 非空就说明表单还没长齐，别继续往下走。
   */
  let CAPTION = "__CAPTION__";
  let TITLE = "__TITLE__";
  if (CAPTION.startsWith("__")) return JSON.stringify({ ok: false, why: "占位符未替换：CAPTION / TITLE" });

  const doc = [...document.querySelectorAll("iframe")]
    .map((f) => {
      try {
        return f.contentDocument;
      } catch (e) {
        return null;
      }
    })
    .find((x) => x && /micro\/content\/post\/create/.test(x.URL || ""));
  if (!doc) return JSON.stringify({ ok: false, why: "没找到子应用文档（表单没渲染 / 成片还在解析）" });

  const win = doc.defaultView;
  const missing = [];

  // 1) 描述：contenteditable 富文本，只能 focus + 选区收末尾 + execCommand('insertText')
  //    话题直接以「#词 + 空格」写进正文，页面自己变成 span.hl.topic 真话题块
  const desc = doc.querySelector('.input-editor[data-placeholder="添加描述"]');
  let descChars = 0;
  let topics = [];
  if (desc) {
    desc.focus();
    const sel = win.getSelection();
    const range = doc.createRange();
    range.selectNodeContents(desc);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    doc.execCommand("insertText", false, CAPTION);
    descChars = (desc.innerText || "").replace(/​/g, "").trim().length;
    topics = [...desc.querySelectorAll(".hl.topic, [data-type='topic']")].map((s) => s.textContent.trim());
  } else missing.push("描述框");

  // 2) 短标题：普通 input，必须走原生 value setter，否则 Vue 的受控值不更新
  const title = doc.querySelector('input.weui-desktop-form__input[placeholder^="填写短标题"]');
  let titleValue = "";
  if (title) {
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set;
    title.focus();
    setter.call(title, TITLE);
    title.dispatchEvent(new win.Event("input", { bubbles: true }));
    title.dispatchEvent(new win.Event("change", { bubbles: true }));
    titleValue = title.value;
  } else missing.push("短标题框");

  // 3) AI 生成内容标注（合规必选）：.post-with-mark-tag → 展开 .select-display → 点选项
  let aiLabel = "";
  const markRow = doc.querySelector(".post-with-mark-tag");
  if (markRow) {
    const shown = markRow.querySelector(".select-value");
    if (!shown || !/含AI生成内容/.test(shown.textContent)) {
      const display = markRow.querySelector(".select-display");
      if (display) display.click();
      const opt = [...markRow.querySelectorAll(".mark-tag-option")].find((e) =>
        /含AI生成内容/.test(e.textContent),
      );
      if (opt) opt.click();
      else missing.push("AI 标注选项");
    }
    aiLabel = (markRow.querySelector(".select-value")?.textContent || "").trim();
  } else missing.push("视频标注行");

  return JSON.stringify({
    ok: !missing.length && descChars > 0 && !!titleValue && /含AI生成内容/.test(aiLabel),
    descChars,
    topics,
    title: titleValue,
    aiLabel,
    missing,
  });
})()
