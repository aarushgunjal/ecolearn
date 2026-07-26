# Kaggle training handoff

1. In EcoLearn, go to **Profile → Admin review**, approve feedback with a final label, then press **Export for Kaggle**.
2. Within one hour, run:

   ```powershell
   python -m pip install -r training/requirements.txt
   python training/prepare_kaggle_dataset.py C:\path\to\ecolearn-training-YYYY-MM-DD.json
   ```

3. Create a **private** Kaggle Dataset and upload the generated `ecolearn-feedback-dataset` folder. Do not make it public: it contains user-contributed images.
4. Attach that private dataset to your existing notebook. It is arranged as `train/<label>`, `valid/<label>`, and `test/<label>` with the classifier’s exact ten labels.
5. Keep `test` untouched until model selection. Compare candidate per-class precision/recall, especially `battery` and `biological`, against the deployed model.
6. Save the notebook output, metrics, dataset date, and model version. Only then export the new ONNX model and deploy it behind a new `model_version`.

The manifest uses temporary signed URLs and anonymous group hashes. The script keeps each contributor in one split to reduce leakage. It does not upload anything or use Kaggle credentials.
