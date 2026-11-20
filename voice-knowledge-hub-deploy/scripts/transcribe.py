import argparse
import json
import os
import re
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_CACHE = PROJECT_ROOT / "data" / "models" / "hub"


def local_model_path(model_name: str) -> Path | None:
    """Return a complete cached faster-whisper snapshot without network access."""
    supplied = Path(model_name)
    if supplied.is_dir():
        return supplied.resolve()

    repository = MODEL_CACHE / f"models--Systran--faster-whisper-{model_name}"
    ref = repository / "refs" / "main"
    if not ref.is_file():
        return None
    revision = ref.read_text(encoding="utf-8").strip()
    snapshot = repository / "snapshots" / revision
    required = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
    return snapshot if all((snapshot / filename).is_file() for filename in required) else None


def timecode(seconds: float) -> str:
    seconds = max(0, int(seconds))
    return f"{seconds // 3600:02d}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def paragraphs(segments, target_chars=320):
    result, paragraph_sentences, sentence_parts = [], [], []
    paragraph_length = sentence_length = 0
    for segment in segments:
        text = clean_spoken_text(segment["text"])
        if not text:
            continue
        if sentence_parts and text == sentence_parts[-1]:
            continue
        sentence_parts.append(text.rstrip("，。！？；"))
        sentence_length += len(text)
        if sentence_length >= 85 or (re.search(r"[。！？]$", text) and sentence_length >= 45):
            sentence = "".join(sentence_parts) + "。"
            paragraph_sentences.append(sentence)
            paragraph_length += len(sentence)
            sentence_parts, sentence_length = [], 0
        if paragraph_length >= target_chars:
            result.append("".join(paragraph_sentences))
            paragraph_sentences, paragraph_length = [], 0
    if sentence_parts:
        paragraph_sentences.append("".join(sentence_parts) + "。")
    if paragraph_sentences:
        result.append("".join(paragraph_sentences))
    return "\n\n".join(result)


def clean_spoken_text(text: str) -> str:
    """Conservatively remove fillers and adjacent oral repetitions."""
    text = re.sub(r"\s+", "", text.strip())
    text = re.sub(
        r"(^|[，。！？；：])(?:嗯+|呃+|额+|啊+|哦+|这个|那个|就是|然后|其实|就是说|怎么说呢)+[，、 ]*",
        r"\1",
        text,
    )
    text = re.sub(r"(?:对吧|是吧|你知道吧)(?=[，。！？；]|$)", "", text)
    text = re.sub(r"([\u4e00-\u9fff]{2,6})(?:[、， ]*\1){1,}", r"\1", text)
    text = re.sub(r"([，。！？；])\1+", r"\1", text)
    return text.strip("，、 ")


def merge_speaker_segments(segments):
    """Combine consecutive ASR fragments belonging to the same speaker."""
    merged = []
    for segment in segments:
        if merged and merged[-1]["speaker"] == segment["speaker"]:
            merged[-1]["text"] += segment["text"]
            merged[-1]["endSeconds"] = segment["endSeconds"]
            continue
        merged.append(dict(segment))
    for index, segment in enumerate(merged):
        segment["index"] = index
        segment["endAt"] = timecode(segment["endSeconds"])
    return merged


def knowledge_for(record_type: str, optimized_text: str):
    compact = re.sub(r"\s+", " ", optimized_text).strip()
    summary = compact[:260] + ("……" if len(compact) > 260 else "")
    points = [part.strip() for part in re.split(r"\n+|(?<=[。！？])", optimized_text) if part.strip()]
    key_points = "\n".join(f"- {part[:180]}" for part in points[:6])
    decisions = "\n".join(f"- {part[:180]}" for part in points if re.search(r"确定|决定|采用|同意|明确", part))
    actions = "\n".join(f"- {part[:180]}" for part in points if re.search(r"需要|负责|计划|后续|下一步|完成|提交|联系", part))
    risks = "\n".join(f"- {part[:180]}" for part in points if re.search(r"问题|风险|待确认|不确定|困难", part))

    templates = {
        "会议纪要": {"meetingSummary": summary, "discussionPoints": key_points, "decisions": decisions, "actions": actions, "risks": risks},
        "语音通话": {"callPurpose": summary, "keyInformation": key_points, "commitments": actions, "followUp": actions, "openQuestions": risks},
        "客户沟通": {"customerContext": summary, "needs": key_points, "painPoints": risks, "solution": decisions, "objections": risks, "nextSteps": actions},
        "工作记录": {"workSummary": summary, "progress": key_points, "issues": risks, "conclusions": decisions, "nextSteps": actions},
        "灵感笔记": {"coreIdea": summary, "inspiration": key_points, "value": "", "assumptions": risks, "possibleActions": actions},
        "其他": {"summary": summary, "keyPoints": key_points, "conclusions": decisions, "actions": actions},
    }
    selected = record_type if record_type in templates else "其他"
    return {"templateType": selected, "sections": templates[selected]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    parser.add_argument("--language", default="zh")
    parser.add_argument("--record-type", default="其他")
    args = parser.parse_args()

    from faster_whisper import WhisperModel

    cached_model = local_model_path(args.model)
    if cached_model is None:
        raise RuntimeError(
            f"本地 Whisper 模型 {args.model!r} 不完整。"
            "请先运行 scripts/download_whisper_model.py，转写过程不会自动联网下载。"
        )

    model = WhisperModel(
        str(cached_model),
        device="auto",
        compute_type="int8",
        local_files_only=True,
    )
    stream, info = model.transcribe(
        args.input,
        language=args.language or None,
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=True,
    )
    transcript = []
    for index, segment in enumerate(stream):
        text = segment.text.strip()
        if not text:
            continue
        transcript.append({
            "index": index,
            "speaker": "说话人1",
            "at": timecode(segment.start),
            "seconds": round(segment.start, 3),
            "endSeconds": round(segment.end, 3),
            "text": text,
        })

    transcript = merge_speaker_segments(transcript)
    full_text = "".join(item["text"] for item in transcript)
    optimized_text = paragraphs(transcript)
    knowledge = knowledge_for(args.record_type, optimized_text)
    summary = next(iter(knowledge["sections"].values()), "")
    sections = knowledge["sections"]
    decision_text = sections.get("decisions") or sections.get("conclusions") or sections.get("solution") or ""
    action_text = sections.get("actions") or sections.get("followUp") or sections.get("nextSteps") or sections.get("possibleActions") or ""
    decisions = [line.lstrip("- ").strip() for line in decision_text.splitlines() if line.strip()]
    actions = [{"text": line.lstrip("- ").strip(), "owner": "", "due": ""} for line in action_text.splitlines() if line.strip()]
    duration_seconds = float(getattr(info, "duration", 0) or 0)
    result = {
        "model": args.model,
        "language": getattr(info, "language", args.language),
        "languageProbability": round(float(getattr(info, "language_probability", 0) or 0), 4),
        "seconds": round(duration_seconds),
        "duration": timecode(duration_seconds),
        "transcript": transcript,
        "optimizedText": optimized_text,
        "summary": summary,
        "decisions": decisions,
        "actions": actions,
        "knowledge": knowledge,
        "transcribedAt": datetime.now().astimezone().isoformat(),
        "characterCount": len(full_text),
    }
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
