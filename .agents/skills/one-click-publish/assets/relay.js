(() => {
  /**
   * 发布助手 · 页内上传中继（贴进 huashu-chrome 的 eval 里执行，一个表达式）
   *
   * 解决的问题：视频号助手 / 抖音后台把上传框放在同源子应用 iframe（wujie 微前端）里，
   * 扩展的 upload 只在顶层文档找 input[type=file]，找不到就把文件当拖放丢到 body 上，
   * 页面不认；而拖放那条路还有 48MB 的字节上限，成片动不动 40MB+ 会撞墙。
   *
   * 做法：在顶层文档造两个「代理 input」（视频 / 图片各一个，带明显 id 与 accept），
   * 让扩展用 CDP 的 DOM.setFileInputFiles 把本地文件投给代理（浏览器自己读盘，无体积上限），
   * 代理的 change 事件里再由页面自己把 File 转发进真正的上传框（同进程同域，合法）。
   *
   * 转发结果写在 window.__hcRelay.last，用一条 eval 读出来即可判断成败。
   */
  if (window.__hcRelay && window.__hcRelay.installed) {
    return JSON.stringify({ installed: true, note: "中继已在页上", last: window.__hcRelay.last || null });
  }

  const KINDS = {
    video: { accept: "video/mp4,video/x-m4v,video/*", hint: "video" },
    image: { accept: "image/png,image/jpeg,image/webp,image/*", hint: "image" },
  };

  const state = { installed: true, last: null, log: [] };
  window.__hcRelay = state;

  // 真上传框在哪：顶层 + 所有同源 iframe（含 shadow DOM 里挂的 iframe）都翻一遍
  const collectDocs = (doc, out, depth) => {
    if (!doc || depth > 4) return out;
    out.push(doc);
    const nodes = doc.querySelectorAll ? doc.querySelectorAll("iframe") : [];
    for (const f of nodes) {
      try {
        if (f.contentDocument) collectDocs(f.contentDocument, out, depth + 1);
      } catch (e) {
        /* 跨域 iframe 穿不过去，跳过 */
      }
    }
    if (doc.querySelectorAll) {
      for (const el of doc.querySelectorAll("*")) {
        try {
          if (el.shadowRoot) collectDocs(el.shadowRoot, out, depth + 1);
        } catch (e) {}
      }
    }
    return out;
  };

  const findRealInput = (kind) => {
    const hint = KINDS[kind].hint;
    const docs = collectDocs(document, [], 0);
    for (const d of docs) {
      if (!d.querySelectorAll) continue;
      const hit = [...d.querySelectorAll('input[type=file]')].find(
        (i) => !i.id.startsWith("__hcRelay") && (i.accept || "").includes(hint),
      );
      if (hit) return { input: hit, doc: d };
    }
    return null;
  };

  const forward = (kind, file) => {
    const found = findRealInput(kind);
    if (!found) {
      state.last = { ok: false, kind, why: "页面上没找到真上传框（可能表单还没渲染）", bytes: file.size };
      return;
    }
    const { input, doc } = found;
    const win = (doc.defaultView) || window;
    try {
      const dt = new win.DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new win.Event("input", { bubbles: true }));
      input.dispatchEvent(new win.Event("change", { bubbles: true }));
      state.last = {
        ok: input.files.length > 0,
        kind,
        bytes: file.size,
        name: file.name,
        where: doc === document ? "top" : (doc.URL || "iframe").slice(0, 70),
        accept: input.accept || "",
      };
    } catch (e) {
      state.last = { ok: false, kind, why: String((e && e.message) || e), bytes: file.size };
    }
  };

  for (const [kind, cfg] of Object.entries(KINDS)) {
    const relay = document.createElement("input");
    relay.type = "file";
    relay.id = "__hcRelay_" + kind;
    relay.accept = cfg.accept;
    relay.style.cssText = "position:fixed;left:-12000px;top:0;width:1px;height:1px;opacity:0";
    relay.addEventListener("change", () => {
      const file = relay.files && relay.files[0];
      if (file) forward(kind, file);
    });
    document.documentElement.appendChild(relay);
  }

  return JSON.stringify({
    installed: true,
    relays: Object.keys(KINDS).map((k) => "#__hcRelay_" + k),
    videoInputNow: !!findRealInput("video"),
    imageInputNow: !!findRealInput("image"),
  });
})()
