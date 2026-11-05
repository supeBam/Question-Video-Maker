#!/usr/bin/env python3
"""提取文案并拆解爆火基因

用法：
    # 从文本文件提取
    python scripts/rewriter/extract-script.py --text script.txt

    # 从视频提取（调用FunASR）
    python scripts/rewriter/extract-script.py --video video.mp4

    # 从文本直接输入
    python scripts/rewriter/extract-script.py --input "你知道吗？..."
"""
import re
import json
import argparse
import subprocess
from pathlib import Path
from collections import Counter

def extract_from_video(video_path):
    """从视频提取文案（调用FunASR）"""
    print(f"正在提取视频文案：{video_path}")

    # 调用 transcribe-ref.py
    cmd = [
        ".venv-asr/bin/python",
        "scripts/utils/transcribe-ref.py",
        video_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"错误：{result.stderr}")
        return None

    # 解析输出，提取文案
    # transcribe-ref.py 的输出格式需要查看
    return result.stdout.strip()

def analyze_structure(text):
    """分析文案结构"""
    sentences = re.split(r'[。！？\n]', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    structure = {
        "total_sentences": len(sentences),
        "sentences": sentences,
        "sentence_lengths": [len(s) for s in sentences],
        "avg_length": sum(len(s) for s in sentences) / len(sentences) if sentences else 0
    }

    # 识别开场钩子
    first_sentence = sentences[0] if sentences else ""
    if first_sentence.startswith("你知道吗"):
        structure["hook_type"] = "反问句-你知道吗"
    elif "?" in first_sentence or "吗" in first_sentence:
        structure["hook_type"] = "疑问句"
    elif "!" in first_sentence or "卧槽" in first_sentence:
        structure["hook_type"] = "感叹句"
    else:
        structure["hook_type"] = "陈述句"

    return structure

def analyze_rhythm(sentences):
    """分析文案节奏"""
    lengths = [len(s) for s in sentences]

    rhythm = {
        "sentence_count": len(sentences),
        "lengths": lengths,
        "avg_length": sum(lengths) / len(lengths) if lengths else 0,
        "length_variance": "变化大" if max(lengths) - min(lengths) > 10 else "较均匀"
    }

    # 检测节奏模式
    if all(8 <= l <= 15 for l in lengths):
        rhythm["pattern"] = "短句为主（易读）"
    elif all(l > 15 for l in lengths):
        rhythm["pattern"] = "长句为主（信息密集）"
    else:
        rhythm["pattern"] = "长短句交替（节奏感强）"

    return rhythm

def extract_keywords(text, top_n=10):
    """提取关键词（简化版）"""
    # 移除标点
    text_clean = re.sub(r'[^\w\s]', ' ', text)

    # 分词（简单按空格和长度）
    words = []
    for word in text_clean.split():
        if len(word) >= 2:  # 至少2个字
            words.append(word)

    # 统计词频
    word_counts = Counter(words)

    # 过滤停用词（简化版）
    stopwords = {"这里", "这个", "那个", "什么", "怎么", "已经", "现在", "然后"}
    keywords = [(w, c) for w, c in word_counts.most_common(top_n * 2) if w not in stopwords]

    return keywords[:top_n]

def detect_emotion(text):
    """检测情绪曲线"""
    # 简化版：检测情绪词
    emotion_words = {
        "好奇": ["你知道吗", "猜猜", "想不到", "居然"],
        "震撼": ["卧槽", "太", "非常", "竟然", "真的"],
        "认同": ["这就是", "所以", "因此", "确实"]
    }

    detected = []
    for emotion, words in emotion_words.items():
        for word in words:
            if word in text:
                detected.append(emotion)
                break

    return detected if detected else ["平淡"]

def analyze_script(text):
    """完整拆解文案"""
    print("\n" + "="*60)
    print("文案拆解分析")
    print("="*60)

    # 1. 结构分析
    structure = analyze_structure(text)
    print(f"\n【结构分析】")
    print(f"总句数：{structure['total_sentences']}")
    print(f"开场钩子：{structure['hook_type']}")
    print(f"平均句长：{structure['avg_length']:.1f}字")

    # 2. 节奏分析
    rhythm = analyze_rhythm(structure['sentences'])
    print(f"\n【节奏分析】")
    print(f"句长分布：{rhythm['lengths']}")
    print(f"节奏模式：{rhythm['pattern']}")

    # 3. 关键词
    keywords = extract_keywords(text)
    print(f"\n【关键词】")
    for word, count in keywords[:5]:
        print(f"  {word}: {count}次")

    # 4. 情绪曲线
    emotions = detect_emotion(text)
    print(f"\n【情绪曲线】")
    print(f"  {' → '.join(emotions)}")

    # 5. 爆火基因总结
    print(f"\n【爆火基因】")
    genes = []
    if structure['hook_type'] in ["反问句-你知道吗", "疑问句"]:
        genes.append("✓ 开场钩子强（反问/疑问）")
    if rhythm['pattern'] == "短句为主（易读）":
        genes.append("✓ 节奏快（短句）")
    elif rhythm['pattern'] == "长短句交替（节奏感强）":
        genes.append("✓ 节奏有变化")
    if "好奇" in emotions and "震撼" in emotions:
        genes.append("✓ 情绪递进（好奇→震撼）")

    for gene in genes:
        print(f"  {gene}")

    # 返回结构化数据
    return {
        "original_text": text,
        "structure": structure,
        "rhythm": rhythm,
        "keywords": dict(keywords),
        "emotions": emotions,
        "genes": genes
    }

def save_analysis(analysis, output_file):
    """保存分析结果"""
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(analysis, f, ensure_ascii=False, indent=2)
    print(f"\n✓ 分析结果已保存：{output_file}")

def main():
    parser = argparse.ArgumentParser(description="提取文案并拆解爆火基因")
    parser.add_argument("--text", help="文本文件路径")
    parser.add_argument("--video", help="视频文件路径")
    parser.add_argument("--input", help="直接输入文案")
    parser.add_argument("--output", default="script-analysis.json", help="输出文件")
    args = parser.parse_args()

    # 获取文案
    if args.input:
        text = args.input
    elif args.text:
        with open(args.text, encoding="utf-8") as f:
            text = f.read()
    elif args.video:
        text = extract_from_video(args.video)
        if not text:
            return
    else:
        parser.error("请指定 --text, --video 或 --input")

    # 分析文案
    analysis = analyze_script(text)

    # 保存结果
    save_analysis(analysis, args.output)

if __name__ == "__main__":
    main()
