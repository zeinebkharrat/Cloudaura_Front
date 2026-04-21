"""
Travel city recommender API (HistGradientBoostingClassifier + one-hot pipeline).

Train & export model from repo root:
  python scripts/generate_tunisia_travel_dataset.py
  python scripts/train_travel_match_model.py

Run locally:
  pip install -r travel-recommendation/requirements.txt
  python travel-recommendation/app.py

POST /api/recommend  JSON body = TravelPreferencePayload (+ optional topN).
"""
from __future__ import annotations

import os
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.environ.get("TRAVEL_MATCH_MODEL", str(ROOT / "travel-recommendation" / "model_bundle.joblib")))

CATEGORICAL = [
    "gender",
    "nationality",
    "current_city",
    "travel_style",
    "budget_level",
    "preferred_region",
    "preferred_cuisine",
    "travel_with",
    "transport_preference",
    "accommodation_type",
    "travel_intensity",
]
NUMERIC = ["age", "budget_avg", "is_group"]

app = Flask(__name__)
_pipe = None


def load_model():
    global _pipe
    if _pipe is None:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Missing {MODEL_PATH} — run scripts/train_travel_match_model.py")
        _pipe = joblib.load(MODEL_PATH)
    return _pipe


def payload_to_row(prefs: dict) -> pd.DataFrame:
    styles = prefs.get("travel_styles")
    if isinstance(styles, list) and len(styles) > 0:
        travel_style = str(styles[0]).strip().lower()
    else:
        travel_style = str(prefs.get("travel_style") or "cultural").strip().lower()

    row: dict = {}
    for c in CATEGORICAL:
        if c == "travel_style":
            row[c] = travel_style
        else:
            row[c] = str(prefs.get(c, "") or "").strip()

    row["age"] = float(prefs.get("age", 32))
    row["budget_avg"] = float(prefs.get("budget_avg", 180))
    row["is_group"] = int(prefs.get("is_group", 0) or 0)

    return pd.DataFrame([row])


@app.get("/health")
def health():
    try:
        p = load_model()
        clf = p.named_steps.get("clf")
        n_classes = len(getattr(clf, "classes_", []))
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 500
    return jsonify({"ok": True, "classes": n_classes})


@app.post("/api/recommend")
def recommend():
    prefs = request.get_json(silent=True) or {}
    top_n = int(prefs.get("topN", prefs.get("top_n", 8)))
    top_n = max(1, min(24, top_n))

    pipe = load_model()
    clf = pipe.named_steps["clf"]
    X = payload_to_row(prefs)
    proba = pipe.predict_proba(X)[0]
    classes = list(clf.classes_)
    ranked_idx = sorted(range(len(proba)), key=lambda i: proba[i], reverse=True)[:top_n]

    cities = [{"cityName": str(classes[i]), "score01": float(proba[i])} for i in ranked_idx]

    # Normalize scores over returned slice for UI (sums to 1)
    s = sum(c["score01"] for c in cities) or 1.0
    for c in cities:
        c["score01"] /= s

    return jsonify(
        {
            "schemaVersion": 1,
            "source": "hist_gradient_boosting",
            "cities": cities,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    load_model()
    app.run(host="127.0.0.1", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
