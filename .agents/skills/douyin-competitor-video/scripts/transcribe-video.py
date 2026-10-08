#!/usr/bin/env python3
"""把视频/音频转写成带时间戳的中文文案（ASR 本地转写，FunASR 单引擎）。

用法:
    .venv-asr/bin/python .agents/skills/douyin-competitor-video/scripts/transcribe-video.py <音频或视频路径> [选项]

选项:
    --hotword 词1,词2,词3     热词表：强制模型倾向这些词，用于压同音/近音误听
                              （如「杜甫,脉脉,契,秣陵」）。

引擎说明:
    阿里达摩院 FunASR paraformer-zh：中文精度高、支持 hotword 热词表、
    附带 VAD 语音切分 + 标点恢复，转写结果自带标点。本地推理，CPU 即可，远超实时。
    （2026-09-30 起 whisper 引擎已全面退役删除，不再提供回退。）

输出: 与源文件同目录的 <同名>.md（带时间戳）和 <同名>.txt（纯文本）。

依赖: funasr（见 SKILL.md「前置依赖」）。
模型缓存:
    写 <项目根>/work/modelscope/（避开 ~/.cache 与 ~/.modelscope 的沙箱限制），
    可用 MODELSCOPE_CACHE / MODELSCOPE_CREDENTIALS_PATH 覆盖。
"""
import os
import sys

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# 项目根 = .agents/skills/douyin-competitor-video/scripts 上溯 4 级
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(_SCRIPT_DIR))))


def _setup_env():
    """把模型/凭证缓存指到项目内（DSH 沙箱禁写 home 下 .cache/.modelscope）。"""
    _ms_root = os.path.join(_PROJECT_ROOT, "work", "modelscope")
    if not os.environ.get("MODELSCOPE_CACHE"):
        os.environ["MODELSCOPE_CACHE"] = os.path.join(_ms_root, "cache")
    if not os.environ.get("MODELSCOPE_CREDENTIALS_PATH"):
        os.environ["MODELSCOPE_CREDENTIALS_PATH"] = os.path.join(_ms_root, "credentials")
    if not os.environ.get("MODELSCOPE_PLUGINS_FILE"):
        os.environ["MODELSCOPE_PLUGINS_FILE"] = os.path.join(_ms_root, "plugins", ".modelscope_plugins")


def _ts(s):
    m, sec = int(s // 60), int(s % 60)
    return f"{m:02d}:{sec:02d}"


def _write_outputs(base, src_basename, engine_label, duration, segments):
    """segments: list[(start, end, text)]。统一写 md（带时间戳）+ txt（纯文本）。"""
    md = [
        f"# 转写结果 · {src_basename}",
        "",
        f"> 引擎 {engine_label} · 语言 zh · 时长 {duration:.1f}s",
        "",
    ]
    txt = []
    for start, end, text in segments:
        t = text.strip()
        if not t:
            continue
        md.append(f"[{_ts(start)}-{_ts(end)}] {t}")
        txt.append(t)

    with open(base + ".md", "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    with open(base + ".txt", "w", encoding="utf-8") as f:
        f.write("\n".join(txt) + "\n")
    print(f"完成: {base}.md / {base}.txt", flush=True)


def _run_funasr(src, hotword):
    from funasr import AutoModel

    print("加载 FunASR paraformer-zh + VAD + 标点 ...", flush=True)
    model = AutoModel(
        model="iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
        vad_model="fsmn-vad",
        punc_model="ct-punc",
        disable_update=True,
    )

    print(f"转写中: {src}", flush=True)
    kwargs = {"input": src}
    if hotword:
        kwargs["hotword"] = hotword
        print(f"热词表: {hotword}", flush=True)
    res = model.generate(**kwargs)

    segments = []
    duration = 0.0
    if res:
        r = res[0]
        full_text = (r.get("text") or "").strip()
        # timestamp: [[start_ms, end_ms], ...] 字级对齐；总时长取最后一段的 end
        ts_list = r.get("timestamp") or []
        if ts_list and isinstance(ts_list[0], (list, tuple)):
            try:
                duration = ts_list[-1][1] / 1000.0
            except Exception:
                duration = 0.0

        # 按标点把 text 切成句子，并按 ts_list 长度线性映射每句起止时间
        if full_text:
            sentences = _split_sentences(full_text)
            if sentences and ts_list:
                n_ts = len(ts_list)
                n_sent = len(sentences)
                # 每句占用的时间戳块数（近似等分）
                for idx, sent in enumerate(sentences):
                    i0 = int(round(idx * n_ts / n_sent))
                    i1 = int(round((idx + 1) * n_ts / n_sent))
                    start = ts_list[i0][0] / 1000.0
                    end = (ts_list[min(i1, n_ts) - 1][1] / 1000.0) if i1 <= n_ts else (ts_list[-1][1] / 1000.0)
                    segments.append((start, end, sent))
                    if end > duration:
                        duration = end
            else:
                segments.append((0.0, duration, full_text))

    # 时长兜底：用 ffprobe 拿真实时长
    if duration <= 0:
        try:
            import subprocess
            out = subprocess.check_output(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "csv=p=0", src]
            ).decode().strip()
            duration = float(out)
        except Exception:
            duration = 0.0

    return segments, duration, "FunASR paraformer-zh"


def _split_sentences(text):
    """按中文标点把整段文本切成句子，保留标点。"""
    import re
    # 在句末标点后切分（。！？；…），保留标点贴在句尾
    parts = re.split(r'(?<=[。！？；…])', text)
    return [p.strip() for p in parts if p.strip()]


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print(__doc__)
        sys.exit(1)

    src = argv[0]
    hotword = ""

    # 解析选项
    rest = argv[1:]
    i = 0
    while i < len(rest):
        a = rest[i]
        if a == "--hotword":
            hotword = rest[i + 1]
            i += 2
        elif a == "--engine":
            print("提示：--engine 已废弃，whisper 引擎已于 2026-09-30 退役，固定使用 FunASR。", flush=True)
            i += 2
        elif a == "--model":
            print("提示：--model 已废弃（原 whisper 档位），FunASR 固定 paraformer-zh 大模型。", flush=True)
            i += 2
        else:
            print(f"忽略未知参数: {a}", flush=True)
            i += 1

    base = os.path.splitext(src)[0]
    _setup_env()

    segments, duration, label = _run_funasr(src, hotword)
    _write_outputs(base, os.path.basename(src), label, duration, segments)


if __name__ == "__main__":
    main()
