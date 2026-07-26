# Fully automated Kaggle training

This is an unattended pipeline once its one-time secrets are connected. It does **not** train from raw submissions: only images with user training consent, an approved review status, and one of the classifier’s ten final labels can enter a batch.

## What happens automatically

1. A review becomes eligible.
2. When 20 eligible examples are waiting, Supabase creates an immutable batch. Change this in **Profile → Admin review** to 50, 100, or 500 at any time.
3. GitHub Actions checks hourly for one queued batch, downloads its one-hour private links, and creates a private Kaggle dataset version.
4. Kaggle runs the included GPU training kernel with augmentation and contributor-grouped splits.
5. The runner rejects a candidate unless it has a test set covering every label, macro F1 ≥ 0.80, and recall ≥ 0.90 for both `battery` and `biological`.
6. Passing models are archived and promoted to your Hugging Face Space automatically. The batch record stores its metrics and model version.

The quality gate is deliberately fail-closed: small or unrepresentative batches may train but will not replace the live model. This prevents a batch of 20 images from degrading the scanner.

## One-time setup

### 1. Supabase

Run `supabase/migrations/202607260003_training_automation.sql` in the SQL Editor after the earlier feedback migrations.

In **Edge Functions → Deploy new function → Via Editor**, deploy these folders' `index.ts` files:

- `export-training-manifest`
- `claim-training-batch`
- `complete-training-batch`
- `lookup-barcode`
- `find-disposal-sites`
- `read-label`

Keep JWT verification **on** for `export-training-manifest`, `lookup-barcode`, `find-disposal-sites`, and `read-label`. Turn it **off only** for `claim-training-batch` and `complete-training-batch`; both enforce `x-training-automation-token` themselves.

Add these Edge Function secrets:

- `ALLOWED_ORIGIN=https://app.ecolearn.dev`
- `OPENROUTER_LABEL_MODEL=google/gemma-4-31b-it:free` (or your existing reliable vision model)
- `TRAINING_AUTOMATION_TOKEN=` a new long random value

`OPENROUTER_API_KEY` and `OPENROUTER_REVIEW_MODEL` should already exist from AI feedback review.

### 2. GitHub repository secrets

In **Settings → Secrets and variables → Actions**, create these secrets:

- `SUPABASE_URL` — your project URL, e.g. `https://PROJECT.supabase.co`
- `TRAINING_AUTOMATION_TOKEN` — exactly the same value as Supabase
- `KAGGLE_API_TOKEN` — create it in Kaggle Settings → API
- `HF_TOKEN` — a Hugging Face write token with access to the Space

Create these repository variables:

- `KAGGLE_FEEDBACK_DATASET` — e.g. `your-kaggle-name/ecolearn-private-feedback`
- `KAGGLE_BASE_DATASET` — your original private waste-classifier dataset handle
- `KAGGLE_KERNEL` — e.g. `your-kaggle-name/ecolearn-auto-trainer`
- `HF_SPACE_REPO` — the Hugging Face Space repository ID
- `HF_SPACE_MODEL_PATH` — the exact active model filename in the Space, likely `waste_classifier (1).onnx`

The workflow is [`.github/workflows/train-waste-model.yml`](../../../.github/workflows/train-waste-model.yml). GitHub runs scheduled workflows from the repository’s default branch, so merge this branch into whichever branch is your platform’s default before relying on unattended runs.

## Changing the cadence

Use **Every 20 images** now. When you have enough high-quality, diverse feedback, choose **Every 500 images** in Admin review. The setting applies to future queued batches; an already queued batch remains immutable.

## Important limitation

No credentials were added by this code; only you can create private Kaggle, Hugging Face, Supabase, and GitHub secrets. After that one-time connection, data collection, batching, Kaggle training, quality checks, and promotion require no manual dataset handling.
