"""Kaggle kernel: fine-tune a 10-class waste classifier from base + feedback data."""
from __future__ import annotations

import json
import os
import hashlib
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from sklearn.metrics import f1_score, precision_recall_fscore_support
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

LABELS = ["battery", "biological", "cardboard", "clothes", "glass", "metal", "paper", "plastic", "shoes", "trash"]
LABEL_TO_INDEX = {label: index for index, label in enumerate(LABELS)}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
INPUT_ROOT = Path("/kaggle/input")
OUTPUT_ROOT = Path("/kaggle/working")

TRAIN_TRANSFORM = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.72, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(12),
    transforms.ColorJitter(brightness=0.18, contrast=0.18, saturation=0.12),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])
EVAL_TRANSFORM = transforms.Compose([
    transforms.Resize(256), transforms.CenterCrop(224), transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def split_for(path: Path) -> str:
    parts = {part.lower() for part in path.parts}
    if "test" in parts:
        return "test"
    if {"valid", "validation", "val"} & parts:
        return "valid"
    return "train"


def collect() -> dict[str, list[tuple[Path, int]]]:
    records = {"train": [], "valid": [], "test": []}
    for file in INPUT_ROOT.rglob("*"):
        if not file.is_file() or file.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        label = next((part.lower() for part in reversed(file.parts) if part.lower() in LABEL_TO_INDEX), None)
        if label:
            records[split_for(file)].append((file, LABEL_TO_INDEX[label]))
    # The public base dataset is class-foldered, not necessarily pre-split. Build
    # reproducible 80/10/10 splits only where a split was not supplied already.
    needs_valid, needs_test = not records["valid"], not records["test"]
    if needs_valid or needs_test:
        retained, generated_valid, generated_test = [], [], []
        for sample in records["train"]:
            bucket = int(hashlib.sha256(str(sample[0]).encode()).hexdigest()[:8], 16) % 100
            if needs_test and bucket < 10:
                generated_test.append(sample)
            elif needs_valid and bucket < 20:
                generated_valid.append(sample)
            else:
                retained.append(sample)
        records["train"] = retained
        if needs_valid: records["valid"] = generated_valid
        if needs_test: records["test"] = generated_test
    return records


class WasteDataset(Dataset):
    def __init__(self, samples: list[tuple[Path, int]], transform):
        self.samples, self.transform = samples, transform

    def __len__(self): return len(self.samples)

    def __getitem__(self, index):
        path, label = self.samples[index]
        with Image.open(path) as image:
            return self.transform(image.convert("RGB")), label


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval(); predicted, truth = [], []
    for images, labels in loader:
        logits = model(images.to(device))
        predicted.extend(logits.argmax(dim=1).cpu().tolist())
        truth.extend(labels.tolist())
    if not truth:
        return {"macro_f1": 0, "per_class_recall": {}, "sample_count": 0}
    _, recall, _, support = precision_recall_fscore_support(truth, predicted, labels=list(range(len(LABELS))), zero_division=0)
    return {"macro_f1": float(f1_score(truth, predicted, labels=list(range(len(LABELS))), average="macro", zero_division=0)), "per_class_recall": {LABELS[index]: float(recall[index]) for index in range(len(LABELS))}, "support": {LABELS[index]: int(support[index]) for index in range(len(LABELS))}, "sample_count": len(truth)}


def main():
    torch.manual_seed(42); np.random.seed(42)
    sets = collect()
    if not sets["train"] or not sets["valid"] or not sets["test"]:
        raise RuntimeError("Base dataset must provide train, validation, and test images for safe automatic promotion.")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_loader = DataLoader(WasteDataset(sets["train"], TRAIN_TRANSFORM), batch_size=32, shuffle=True, num_workers=2, pin_memory=True)
    valid_loader = DataLoader(WasteDataset(sets["valid"], EVAL_TRANSFORM), batch_size=64, num_workers=2)
    test_loader = DataLoader(WasteDataset(sets["test"], EVAL_TRANSFORM), batch_size=64, num_workers=2)
    model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    model.fc = nn.Linear(model.fc.in_features, len(LABELS)); model.to(device)
    optimizer = AdamW(model.parameters(), lr=2e-4, weight_decay=1e-4)
    loss_fn = nn.CrossEntropyLoss()
    best_state, best_f1 = None, -1.0
    for _ in range(6):
        model.train()
        for images, labels in train_loader:
            optimizer.zero_grad(); loss = loss_fn(model(images.to(device)), labels.to(device)); loss.backward(); optimizer.step()
        metrics = evaluate(model, valid_loader, device)
        if metrics["macro_f1"] > best_f1:
            best_f1, best_state = metrics["macro_f1"], {key: value.cpu() for key, value in model.state_dict().items()}
    model.load_state_dict(best_state)
    test_metrics = evaluate(model, test_loader, device)
    test_metrics["labels"] = LABELS
    test_metrics["data_counts"] = {split: dict(Counter(LABELS[label] for _, label in samples)) for split, samples in sets.items()}
    test_metrics["model_version"] = f"ecolearn-resnet50-{os.environ.get('KAGGLE_KERNEL_RUN_TYPE', 'batch')}"
    test_metrics["promotable"] = all(test_metrics["support"].get(label, 0) > 0 for label in LABELS)
    model.eval()
    torch.onnx.export(model.cpu(), torch.randn(1, 3, 224, 224), OUTPUT_ROOT / "waste_classifier.onnx", input_names=["input"], output_names=["logits"], dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"},}, opset_version=17)
    (OUTPUT_ROOT / "metrics.json").write_text(json.dumps(test_metrics, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
