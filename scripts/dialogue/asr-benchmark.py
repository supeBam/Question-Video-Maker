#!/usr/bin/env python
"""FunASR paraformer-zh 冒烟测试（单引擎，2026-09-30 起 whisper 对照已删除）。

用法：
    .venv-asr/bin/python scripts/dialogue/asr-benchmark.py [音频文件] [--hotword 词1,词2,...]

默认用 out/老天爷01-杜甫-minimax.mp3（含高危字「杜甫」）。
用途：FunASR 环境/模型缓存是否就绪的快速验证（加载耗时 + 推理耗时 + 转写文本）。
"""
import sys
import time
import json
import os

# modelscope 会写 ~/.cache/modelscope（模型）和 ~/.modelscope（凭证），两者都被 DSH 沙箱拦截，
# 统一改到项目内 work/ 下（已 gitignore）。凭证路径必须设 MODELSCOPE_CREDENTIALS_PATH，缓存设 MODELSCOPE_CACHE。
_WORK = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "work", "modelscope")
os.environ.setdefault("MODELSCOPE_CACHE", os.path.join(_WORK, "cache"))
os.environ.setdefault("MODELSCOPE_CREDENTIALS_PATH", os.path.join(_WORK, "credentials"))
os.environ.setdefault("MODELSCOPE_PLUGINS_FILE", os.path.join(_WORK, "plugins", ".modelscope_plugins"))

def main():
    audio = sys.argv[1] if len(sys.argv) > 1 else "out/老天爷01-杜甫-minimax.mp3"
    hotwords = None
    if "--hotword" in sys.argv:
        hotwords = sys.argv[sys.argv.index("--hotword") + 1]

    results = {}

    print("=" * 60)
    print("FunASR paraformer-zh (本地, 阿里达摩院) 冒烟测试")
    print("=" * 60)
    try:
        from funasr import AutoModel
        t0 = time.time()
        model = AutoModel(
            model="iic/speech_seaco_paraformer_large_asr_nat-zh-cn-16k-common-vocab8404-pytorch",
            vad_model="fsmn-vad",
            punc_model="ct-punc",
            disable_update=True,
        )
        load_t = time.time() - t0
        print(f"  模型加载（含首次下载权重）: {load_t:.1f}s")

        t0 = time.time()
        if hotwords:
            res = model.generate(input=audio, hotword=hotwords)
        else:
            res = model.generate(input=audio)
        infer_t = time.time() - t0

        text = res[0]["text"] if res else ""
        results["funasr"] = {
            "加载耗时s": round(load_t, 1),
            "推理耗时s": round(infer_t, 2),
            "文本": text,
        }
        print(f"  推理耗时: {infer_t:.2f}s")
        if hotwords:
            print(f"  热词表: {hotwords}")
        print(f"  转写结果:\n  ┌ {text}")
    except Exception as e:
        results["funasr"] = {"错误": str(e)}
        print(f"  ❌ FunASR 失败: {e}", flush=True)

    print()
    print("=" * 60)
    print("汇总（JSON）")
    print("=" * 60)
    print(json.dumps(results, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
