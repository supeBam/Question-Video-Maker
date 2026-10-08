#!/usr/bin/env python
"""参考视频转写：FunASR paraformer-zh 带时间戳输出。

用法：
    .venv-asr/bin/python scripts/transcribe-ref.py out/ref-国庆放假-xWT111.wav
输出：
    out/ref-国庆放假-xWT111.txt      纯文本
    out/ref-国庆放假-xWT111.md       带时间戳分段
"""
import os
import sys

_WORK = os.path.join(os.getcwd(), "work", "modelscope")
os.makedirs(_WORK, exist_ok=True)
os.environ.setdefault("MODELSCOPE_CACHE", os.path.join(_WORK, "cache"))
os.environ.setdefault("MODELSCOPE_CREDENTIALS_PATH", os.path.join(_WORK, "credentials"))
os.environ.setdefault("MODELSCOPE_PLUGINS_FILE", os.path.join(_WORK, "plugins", ".modelscope_plugins"))

from funasr import AutoModel


def fmt_ts(ms):
    s = ms / 1000.0
    m = int(s // 60)
    sec = s - m * 60
    return f"{m:02d}:{sec:05.2f}"


def main():
    audio = sys.argv[1]
    base = os.path.splitext(audio)[0]

    model = AutoModel(
        model="iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        disable_update=True,
    )
    res = model.generate(input=audio)
    if not res:
        print("无识别结果")
        return
    r = res[0]
    text = r.get("text", "")

    # 纯文本
    txt_path = base + ".txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(f"[写出] {txt_path}  共{len(text)}字")

    # 带时间戳分段
    md_path = base + ".md"
    ts = r.get("timestamp") or []
    chars = list(r.get("text", ""))
    # 清理标点后按 timestamp 对齐
    import re
    plain_chars = [c for c in chars if not re.match(r"[，。！？、；：…—\s]", c)]
    lines = []
    if ts and len(ts) == len(plain_chars):
        seg, seg_start, prev_end = [], None, None
        i = 0
        for c in chars:
            if re.match(r"[，。！？、；：…—\s]", c):
                if c in "。！？；…" and seg:
                    lines.append((seg_start, prev_end, "".join(seg)))
                    seg, seg_start = [], None
                elif c in "，、" and seg and prev_end is not None and seg_start is not None and (prev_end - seg_start) > 15000:
                    lines.append((seg_start, prev_end, "".join(seg)))
                    seg, seg_start = [], None
                continue
            st, ed = ts[i]
            i += 1
            if seg_start is None:
                seg_start = st
            prev_end = ed
            seg.append(c)
        if seg:
            lines.append((seg_start, prev_end, "".join(seg)))
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 转写：{os.path.basename(audio)}\n\n")
        for st, ed, t in lines:
            f.write(f"- [{fmt_ts(st)} → {fmt_ts(ed)}] {t}\n")
    print(f"[写出] {md_path}  共{len(lines)}段")


if __name__ == "__main__":
    main()
