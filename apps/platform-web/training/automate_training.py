"""GitHub Actions worker for EcoLearn's consented batch-training pipeline."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests
from huggingface_hub import HfApi


ROOT = Path(__file__).resolve().parents[3]
WORK = ROOT / ".training-work"


def require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def endpoint(name: str) -> str:
    return f"{require('SUPABASE_URL').rstrip('/')}/functions/v1/{name}"


def api_call(name: str, body: dict | None = None) -> dict:
    response = requests.post(endpoint(name), json=body or {}, timeout=60, headers={"x-training-automation-token": require("TRAINING_AUTOMATION_TOKEN")})
    response.raise_for_status()
    return response.json()


def run(*args: str, cwd: Path | None = None) -> str:
    return subprocess.run(args, cwd=cwd, check=True, text=True, capture_output=True).stdout


def upload_dataset(dataset_dir: Path, batch_id: str) -> str:
    handle = require("KAGGLE_FEEDBACK_DATASET")
    (dataset_dir / "dataset-metadata.json").write_text(json.dumps({
        "title": "EcoLearn private reviewed feedback",
        "id": handle,
        "licenses": [{"name": "other"}],
        "isPrivate": True,
    }, indent=2), encoding="utf-8")
    try:
        run("kaggle", "datasets", "version", "-p", str(dataset_dir), "-m", f"EcoLearn reviewed feedback batch {batch_id}", "-r", "zip")
    except subprocess.CalledProcessError:
        run("kaggle", "datasets", "create", "-p", str(dataset_dir), "-r", "zip")
    return handle


def run_kernel(feedback_dataset: str) -> Path:
    kernel_dir = ROOT / "apps" / "platform-web" / "training" / "kaggle_kernel"
    metadata = {
        "id": require("KAGGLE_KERNEL"),
        "title": "EcoLearn automated waste classifier training",
        "code_file": "train.py",
        "language": "python",
        "kernel_type": "script",
        "is_private": True,
        "enable_gpu": True,
        "enable_internet": True,
        "dataset_sources": [require("KAGGLE_BASE_DATASET"), feedback_dataset],
    }
    (kernel_dir / "kernel-metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    run("kaggle", "kernels", "push", "-p", str(kernel_dir), "--accelerator", "NvidiaTeslaT4", "--timeout", "7200")
    kernel = metadata["id"]
    for _ in range(120):
        status = run("kaggle", "kernels", "status", kernel).lower()
        if "complete" in status:
            break
        if "error" in status or "cancel" in status:
            raise RuntimeError(f"Kaggle kernel failed: {status}")
        time.sleep(30)
    else:
        raise RuntimeError("Timed out waiting for Kaggle training.")
    output = WORK / "kernel-output"
    output.mkdir(parents=True, exist_ok=True)
    run("kaggle", "kernels", "output", kernel, "-p", str(output))
    return output


def gate_and_promote(output: Path, batch_id: str) -> tuple[str, dict]:
    metrics = json.loads((output / "metrics.json").read_text(encoding="utf-8"))
    macro_f1 = float(metrics.get("macro_f1", 0))
    recall = metrics.get("per_class_recall", {})
    min_f1 = float(os.getenv("MIN_MACRO_F1", "0.80"))
    min_hazard_recall = float(os.getenv("MIN_HAZARDOUS_RECALL", "0.90"))
    safe = bool(metrics.get("promotable")) and macro_f1 >= min_f1 and float(recall.get("battery", 0)) >= min_hazard_recall and float(recall.get("biological", 0)) >= min_hazard_recall
    if not safe:
        raise ValueError(f"Candidate rejected by safety gate: macro F1={macro_f1:.3f}; battery recall={recall.get('battery', 0):.3f}; biological recall={recall.get('biological', 0):.3f}")
    model = output / "waste_classifier.onnx"
    if not model.exists():
        raise RuntimeError("Kaggle output did not contain waste_classifier.onnx")
    version = f"ecolearn-feedback-{batch_id[:8]}"
    api = HfApi(token=require("HF_TOKEN"))
    repo = require("HF_SPACE_REPO")
    active_path = require("HF_SPACE_MODEL_PATH")
    api.upload_file(path_or_fileobj=str(model), path_in_repo=f"models/{version}.onnx", repo_id=repo, repo_type="space", commit_message=f"Archive candidate {version}")
    api.upload_file(path_or_fileobj=str(model), path_in_repo=active_path, repo_id=repo, repo_type="space", commit_message=f"Promote {version} after automated safety gate")
    return version, metrics


def main() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    response = api_call("claim-training-batch")
    batch = response.get("batch")
    if not batch:
        print("No queued training batch.")
        return
    batch_id = batch["id"]
    manifest = WORK / "manifest.json"
    manifest.write_text(json.dumps({"examples": batch["examples"]}, indent=2), encoding="utf-8")
    try:
        dataset = WORK / "dataset"
        run(sys.executable, str(ROOT / "apps" / "platform-web" / "training" / "prepare_kaggle_dataset.py"), str(manifest), "--output", str(dataset))
        feedback_handle = upload_dataset(dataset, batch_id)
        output = run_kernel(feedback_handle)
        version, metrics = gate_and_promote(output, batch_id)
        api_call("complete-training-batch", {"batch_id": batch_id, "status": "succeeded", "model_version": version, "metrics": metrics})
        print(f"Promoted {version}")
    except ValueError as error:
        api_call("complete-training-batch", {"batch_id": batch_id, "status": "rejected", "error_message": str(error)})
        print(str(error))
    except Exception as error:
        api_call("complete-training-batch", {"batch_id": batch_id, "status": "failed", "error_message": str(error)})
        raise


if __name__ == "__main__":
    main()
