"""Download and verify the configured faster-whisper model once."""

import argparse
from pathlib import Path

from huggingface_hub import snapshot_download


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_ROOT = PROJECT_ROOT / "data" / "models"
MODEL_CACHE = MODEL_ROOT / "hub"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="small")
    args = parser.parse_args()

    repository = f"Systran/faster-whisper-{args.model}"
    required = ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt")
    snapshot = Path(
        snapshot_download(
            repo_id=repository,
            cache_dir=MODEL_CACHE,
            allow_patterns=list(required),
        )
    )
    missing = [name for name in required if not (snapshot / name).is_file()]
    if missing:
        raise RuntimeError(f"模型下载不完整，缺少：{', '.join(missing)}")

    total = sum((snapshot / name).stat().st_size for name in required)
    print(f"Whisper 模型已就绪：{snapshot}")
    print(f"核心文件合计：{total / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
