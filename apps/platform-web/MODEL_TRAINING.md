# Feedback-to-training workflow

User feedback is a measurement and data-collection loop, not an automatic retraining trigger.

1. Export only `scan_feedback` rows with `training_consent = true` and `review_status = 'approved'`.
2. A reviewer verifies the image, item label, and disposal correction. Reject duplicates, unclear photos, personal information, and examples outside the model label set.
3. Download the matching object from the private `training-feedback` bucket into an offline review workspace. Keep the database row ID as the example ID; do not use email addresses or user IDs in the training manifest.
4. Map reviewed examples to the classifier's exact class names. Keep the raw user verdict and the reviewer label separately so disagreements remain auditable.
5. Deduplicate images, then split by user and near-duplicate group into train, validation, and a never-touched test set. Do not put photos from the same user/item burst in different splits.
6. Fine-tune only after evaluating the current model against the held-out set. Promote a candidate only when it improves agreed metrics without reducing safety on contamination or hazardous-item classes.
7. Record dataset version, model base, code commit, labels, metrics, reviewer, and date. Deploy a versioned model and write its version into `scan_feedback.model_version`.

Never train directly from unreviewed user submissions. Users may withdraw consent; retain a deletion path that removes both the private object and the associated training-manifest entry.

## What to provide before training

- Hugging Face model/repository and inference or fine-tuning code
- Exact label list and label-to-disposal mapping
- Dataset source and license details
- Minimum acceptable precision/recall by class and a rollback rule
- Retention period, reviewer access list, and consent/deletion policy
