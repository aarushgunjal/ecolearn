"""Turn a short-lived EcoLearn admin manifest into a Kaggle-ready image dataset.

Run this immediately after exporting from the Admin Review panel. The signed image
URLs expire in one hour. The script never uploads data anywhere; upload the
generated directory to a private Kaggle dataset yourself.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

import requests


VALID_LABELS = {
    "battery", "biological", "cardboard", "clothes", "glass",
    "metal", "paper", "plastic", "shoes", "trash",
}


def split_for(source_group: str) -> str:
    """Keep all examples from the same anonymous contributor in one split."""
    bucket = int(hashlib.sha256(source_group.encode()).hexdigest()[:8], 16) % 100
    return "train" if bucket < 80 else "valid" if bucket < 90 else "test"


def extension(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "").lower()
    if "png" in content_type:
        return ".png"
    if "webp" in content_type:
        return ".webp"
    return ".jpg"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path, help="JSON file downloaded from EcoLearn Admin Review")
    parser.add_argument("--output", type=Path, default=Path("ecolearn-feedback-dataset"))
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    examples = manifest.get("examples", [])
    if not examples:
        raise SystemExit("No approved examples in manifest. Review and approve feedback before exporting.")

    output = args.output
    records, skipped, counts = [], [], Counter()
    session = requests.Session()
    session.headers["User-Agent"] = "EcoLearn-Kaggle-Preparation/1.0"

    for index, item in enumerate(examples, start=1):
        label = str(item.get("label", "")).lower()
        example_id, url, source_group = str(item.get("example_id", "")), str(item.get("image_url", "")), str(item.get("source_group", ""))
        if label not in VALID_LABELS or not example_id or not url or not source_group:
            skipped.append({"example_id": example_id, "reason": "invalid manifest record"})
            continue
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            split = split_for(source_group)
            target = output / split / label / f"{example_id}{extension(response)}"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(response.content)
            records.append({"example_id": example_id, "label": label, "split": split, "file": str(target.relative_to(output))})
            counts[(split, label)] += 1
            print(f"[{index}/{len(examples)}] {target}")
        except requests.RequestException as error:
            skipped.append({"example_id": example_id, "reason": str(error)})
            print(f"[{index}/{len(examples)}] skipped {example_id}: {error}")

    (output / "manifest.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    (output / "skipped.json").write_text(json.dumps(skipped, indent=2), encoding="utf-8")
    (output / "README.md").write_text(
        "# EcoLearn reviewed feedback dataset\n\nPrivate, consented and human-approved feedback examples only. Do not publish.\n\nSplits are grouped by anonymous contributor hash to reduce leakage.\n\n"
        + "\n".join(f"- {split}/{label}: {count}" for (split, label), count in sorted(counts.items())) + "\n",
        encoding="utf-8",
    )
    print(f"\nSaved {len(records)} images; skipped {len(skipped)}. Upload {output} as a PRIVATE Kaggle Dataset.")


if __name__ == "__main__":
    main()
