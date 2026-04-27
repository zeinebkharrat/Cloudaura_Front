"""Travel recommendation API using the new multi-target model bundle (schema v2)."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import sklearn
from flask import Flask, jsonify, request

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.environ.get("TRAVEL_MATCH_MODEL", str(ROOT / "travel-recommendation" / "model_bundle.joblib")))

app = Flask(__name__)
_bundle: dict[str, Any] | None = None


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    return " ".join(text.split())


def normalize_pipe_tokens(raw: Any) -> str:
    text = normalize_text(raw)
    if not text:
        return ""
    tokens = [t.strip() for t in text.split("|") if t.strip()]
    if not tokens:
        return ""
    return "|".join(sorted(set(tokens)))


def extract_budget(prefs: dict[str, Any]) -> tuple[float, float]:
    if prefs.get("budget_min") is not None and prefs.get("budget_max") is not None:
        return float(prefs.get("budget_min")), float(prefs.get("budget_max"))

    budget_avg = float(prefs.get("budget_avg", 180.0))
    budget_min = float(prefs.get("budgetMin", budget_avg * 0.7))
    budget_max = float(prefs.get("budgetMax", budget_avg * 1.3))
    if budget_min > budget_max:
        budget_min, budget_max = budget_max, budget_min
    return budget_min, budget_max


def get_pref_value(prefs: dict[str, Any], key: str) -> str:
    legacy_aliases = {
        "accommodation_type": ["accommodation_type", "accommodation"],
        "preferred_cuisine": ["preferred_cuisine", "cuisine_preference"],
        "preferred_region": ["preferred_region"],
        "transport_preference": ["transport_preference", "transport_mode"],
        "travel_with": ["travel_with", "companion_type"],
    }
    for alias in legacy_aliases.get(key, [key]):
        if prefs.get(alias) is not None and str(prefs.get(alias)).strip() != "":
            return normalize_text(prefs.get(alias))
    return ""


def load_model():
    global _bundle
    if _bundle is None:
        if not MODEL_PATH.is_file():
            raise FileNotFoundError(f"Missing {MODEL_PATH} — run scripts/train_travel_match_model.py")
        loaded = joblib.load(MODEL_PATH)
        if isinstance(loaded, dict) and loaded.get("schema_version") == 2:
            _bundle = loaded
        else:
            raise RuntimeError("Unsupported model bundle. Re-train with scripts/train_travel_match_model.py")
    return _bundle


def payload_to_row(prefs: dict[str, Any], bundle: dict[str, Any]) -> pd.DataFrame:
    styles = prefs.get("travel_styles")
    if isinstance(styles, list) and len(styles) > 0:
        travel_style = normalize_pipe_tokens("|".join(str(s) for s in styles))
    else:
        travel_style = normalize_pipe_tokens(prefs.get("travel_style", ""))

    feature_cat = bundle["feature_columns"]["categorical"]
    feature_num = bundle["feature_columns"]["numeric"]
    categories: dict[str, list[str]] = bundle.get("categories", {})
    numeric_mean = bundle.get("numeric_mean", [100.0, 250.0])

    budget_min, budget_max = extract_budget(prefs)

    row: dict[str, Any] = {}
    for c in feature_cat:
        if c == "travel_style":
            val = travel_style
        else:
            val = get_pref_value(prefs, c)

        allowed = set(categories.get(c, []))
        if allowed and val not in allowed:
            # Unknown category -> empty token accepted by OneHot(handle_unknown='ignore').
            val = ""
        row[c] = val

    row_num_map = {
        "budget_min": budget_min,
        "budget_max": budget_max,
    }
    for i, c in enumerate(feature_num):
        default_val = float(numeric_mean[i]) if i < len(numeric_mean) else 0.0
        row[c] = float(row_num_map.get(c, default_val))

    if row.get("budget_min", 0.0) > row.get("budget_max", 0.0):
        row["budget_min"], row["budget_max"] = row["budget_max"], row["budget_min"]

    return pd.DataFrame([row])


def retrieval_city_scores(bundle: dict[str, Any], row: dict[str, Any]) -> dict[str, float]:
    profiles = bundle.get("retrieval_profiles", [])
    if not profiles:
        return {}

    result_max: dict[str, float] = {}
    result_sum: dict[str, float] = {}
    result_count: dict[str, int] = {}
    r_mid = (float(row.get("budget_min", 0.0)) + float(row.get("budget_max", 0.0))) / 2.0

    for p in profiles:
        score = 0.0
        score += 1.0 if normalize_text(p.get("accommodation_type")) == normalize_text(row.get("accommodation_type")) else 0.0
        score += 1.0 if normalize_text(p.get("preferred_cuisine")) == normalize_text(row.get("preferred_cuisine")) else 0.0
        score += 1.4 if normalize_text(p.get("preferred_region")) == normalize_text(row.get("preferred_region")) else 0.0
        score += 1.0 if normalize_text(p.get("transport_preference")) == normalize_text(row.get("transport_preference")) else 0.0
        score += 1.2 if normalize_text(p.get("travel_style")) == normalize_text(row.get("travel_style")) else 0.0
        score += 1.0 if normalize_text(p.get("travel_with")) == normalize_text(row.get("travel_with")) else 0.0

        p_mid = (float(p.get("budget_min", 0.0)) + float(p.get("budget_max", 0.0))) / 2.0
        budget_dist = abs(r_mid - p_mid)
        score += max(0.0, 1.2 - (budget_dist / 250.0))

        city = normalize_text(p.get("city"))
        if not city:
            continue
        if score > result_max.get(city, -1.0):
            result_max[city] = score
        result_sum[city] = result_sum.get(city, 0.0) + score
        result_count[city] = result_count.get(city, 0) + 1

    if not result_max:
        return result_max

    combined: dict[str, float] = {}
    for city, best_score in result_max.items():
        avg_score = result_sum.get(city, 0.0) / max(1, result_count.get(city, 1))
        support = min(1.0, result_count.get(city, 0) / 6.0)
        combined[city] = (best_score * 0.62) + (avg_score * 0.23) + (support * 0.15)

    max_score = max(combined.values()) or 1.0
    return {k: float(v / max_score) for k, v in combined.items()}


def exact_profile_city(bundle: dict[str, Any], row: dict[str, Any]) -> str:
    profiles = bundle.get("retrieval_profiles", [])
    if not profiles:
        return ""

    counts: dict[str, int] = {}
    for p in profiles:
        if normalize_text(p.get("accommodation_type")) != normalize_text(row.get("accommodation_type")):
            continue
        if normalize_text(p.get("preferred_cuisine")) != normalize_text(row.get("preferred_cuisine")):
            continue
        if normalize_text(p.get("preferred_region")) != normalize_text(row.get("preferred_region")):
            continue
        if normalize_text(p.get("transport_preference")) != normalize_text(row.get("transport_preference")):
            continue
        if normalize_text(p.get("travel_style")) != normalize_text(row.get("travel_style")):
            continue
        if normalize_text(p.get("travel_with")) != normalize_text(row.get("travel_with")):
            continue
        if float(p.get("budget_min", -1.0)) != float(row.get("budget_min", -2.0)):
            continue
        if float(p.get("budget_max", -1.0)) != float(row.get("budget_max", -2.0)):
            continue
        city = normalize_text(p.get("city"))
        if city:
            counts[city] = counts.get(city, 0) + 1

    if not counts:
        return ""
    return max(counts.items(), key=lambda kv: kv[1])[0]


@app.get("/health")
def health():
    try:
        b = load_model()
        n_targets = len(b.get("target_columns", []))
        city_count = len(b.get("city_label_map", {}))
        model_sklearn = str(b.get("sklearn_version", ""))
        runtime_sklearn = sklearn.__version__
        version_match = (not model_sklearn) or (model_sklearn == runtime_sklearn)
    except Exception as e:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(e)}), 500
    return jsonify({
        "ok": True,
        "targets": n_targets,
        "cities": city_count,
        "schema": 2,
        "model_sklearn_version": model_sklearn,
        "runtime_sklearn_version": runtime_sklearn,
        "sklearn_version_match": version_match,
    })


@app.post("/api/recommend")
def recommend():
    prefs = request.get_json(silent=True) or {}
    top_n = int(prefs.get("topN", prefs.get("top_n", 8)))
    top_n = max(1, min(24, top_n))

    bundle = load_model()
    city_pipe = bundle["city_pipeline"]
    target_columns: list[str] = bundle["target_columns"]
    city_target_index = int(bundle["city_target_index"])
    city_label_map: dict[str, dict[str, str]] = bundle["city_label_map"]
    ranking_tuning = bundle.get("ranking_tuning", {})
    model_weight = float(ranking_tuning.get("model_weight", 0.63))
    retrieval_weight = float(ranking_tuning.get("retrieval_weight", 0.37))
    region_match_boost = float(ranking_tuning.get("region_match_boost", 1.15))
    region_mismatch_penalty = float(ranking_tuning.get("region_mismatch_penalty", 0.92))
    exact_match_boost = float(ranking_tuning.get("exact_match_boost", 1.65))

    X = payload_to_row(prefs, bundle)
    pred_city = str(city_pipe.predict(X)[0])

    city_classes = [str(c) for c in bundle.get("city_classes", [])]
    city_proba = city_pipe.predict_proba(X)[0]
    if not city_classes:
        clf = city_pipe.named_steps.get("clf")
        city_classes = [str(c) for c in getattr(clf, "classes_", [])]

    preferred_region = normalize_text(prefs.get("preferred_region", ""))
    row_dict = X.iloc[0].to_dict()
    retrieval_scores = retrieval_city_scores(bundle, row_dict)
    exact_city = exact_profile_city(bundle, row_dict)

    scored = []
    for i in range(len(city_classes)):
        model_score = float(city_proba[i])
        retrieval_score = float(retrieval_scores.get(normalize_text(city_classes[i]), 0.0))
        score = (model_weight * model_score) + (retrieval_weight * retrieval_score)
        labels = city_label_map.get(city_classes[i], {})
        if preferred_region and preferred_region != "any":
            city_region = normalize_text(labels.get("recommended_region", ""))
            if city_region == preferred_region:
                score *= region_match_boost
            else:
                score *= region_mismatch_penalty
        if exact_city and normalize_text(city_classes[i]) == exact_city:
            score *= exact_match_boost
        scored.append((i, score))

    ranked_idx = [idx for idx, _ in sorted(scored, key=lambda x: x[1], reverse=True)[:top_n]]

    cities = []
    for i in ranked_idx:
        city_name = city_classes[i]
        labels = city_label_map.get(city_name, {})
        combined_score = next((s for idx, s in scored if idx == i), float(city_proba[i]))
        cities.append(
            {
                "cityName": city_name,
                "score01": float(combined_score),
                "recommended_city_id": str(labels.get("recommended_city_id", "")),
                "recommended_city_name": str(labels.get("recommended_city_name", city_name)),
                "recommended_region": str(labels.get("recommended_region", "")),
                "recommended_activities": str(labels.get("recommended_activities", "")),
                "recommended_event": str(labels.get("recommended_event", "")),
            }
        )

    s = sum(c["score01"] for c in cities) or 1.0
    for c in cities:
        c["score01"] /= s

    pred_city = cities[0]["recommended_city_name"] if cities else pred_city
    pred_labels = city_label_map.get(pred_city, bundle.get("default_prediction", {}))

    prediction = {
        target_columns[0]: str(pred_labels.get("recommended_city_id", "")),
        target_columns[1]: str(pred_city),
        target_columns[2]: str(pred_labels.get("recommended_region", "")),
        target_columns[3]: str(pred_labels.get("recommended_activities", "")),
        target_columns[4]: str(pred_labels.get("recommended_event", "")),
    }

    return jsonify(
        {
            "schemaVersion": 2,
            "source": "city_random_forest_v2",
            "prediction": {
                "recommended_city_id": str(prediction.get("recommended_city_id", pred_labels.get("recommended_city_id", ""))),
                "recommended_city_name": str(pred_city or pred_labels.get("recommended_city_name", "")),
                "recommended_region": str(prediction.get("recommended_region", pred_labels.get("recommended_region", ""))),
                "recommended_activities": str(
                    prediction.get("recommended_activities", pred_labels.get("recommended_activities", ""))
                ),
                "recommended_event": str(prediction.get("recommended_event", pred_labels.get("recommended_event", ""))),
            },
            "cities": cities,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    load_model()
    app.run(host="127.0.0.1", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
