#!/usr/bin/env python3
"""
Train a Tunisia governorate (24 cities) recommender from tunisian_travel_dataset_24c.csv.

Exports:
- frontend/src/assets/travel-match-model.json  (centroid + priors for optional client-only mode)
- travel-recommendation/model_bundle.joblib   (sklearn Pipeline for Flask)

Override CSV: set TRAVEL_MATCH_CSV to a path (e.g. old 1200-row set).

Run: python scripts/train_travel_match_model.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "frontend" / "src" / "assets" / "tunisian_travel_dataset_24c.csv"
CSV_PATH = Path(os.environ.get("TRAVEL_MATCH_CSV", str(DEFAULT_CSV))).resolve()
OUT_JSON = ROOT / "frontend" / "src" / "assets" / "travel-match-model.json"
JOBLIB_PATH = ROOT / "travel-recommendation" / "model_bundle.joblib"

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
TARGET = "city"

# Fixed order must match Angular multi-select encoder for travel_style.
TRAVEL_STYLE_ORDER = ["adventure", "beaches", "cultural", "luxury", "nature", "party", "relaxation"]


def categories_for_columns(df: pd.DataFrame) -> list[list[str]]:
    """One category list per categorical column; travel_style uses fixed order."""
    out: list[list[str]] = []
    for col in CATEGORICAL:
        if col == "travel_style":
            out.append(list(TRAVEL_STYLE_ORDER))
        else:
            vals = sorted(df[col].astype(str).str.strip().str.lower().unique().tolist())
            out.append(vals)
    return out


def build_preprocessor(cat_categories_list: list[list[str]]) -> ColumnTransformer:
    return ColumnTransformer(
        [
            (
                "cat",
                OneHotEncoder(categories=cat_categories_list, handle_unknown="ignore", sparse_output=False),
                CATEGORICAL,
            ),
            ("num", StandardScaler(), NUMERIC),
        ]
    )


def cos_sim(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def main() -> None:
    if not CSV_PATH.is_file():
        raise SystemExit(f"CSV not found: {CSV_PATH}. Run scripts/generate_tunisia_travel_dataset.py first.")

    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=[TARGET])
    for c in CATEGORICAL:
        df[c] = df[c].astype(str).str.strip()
    X = df[CATEGORICAL + NUMERIC]
    y = df[TARGET].astype(str)

    cat_categories_list = categories_for_columns(df)
    preprocessor = build_preprocessor(cat_categories_list)

    cat_categories: dict[str, list[str]] = {
        col: [str(c) for c in cat_categories_list[i]] for i, col in enumerate(CATEGORICAL)
    }

    idx_all = np.arange(len(df))
    idx_train, idx_test, y_train, y_test = train_test_split(
        idx_all, y, test_size=0.2, random_state=42, stratify=y
    )

    X_train_df = X.iloc[idx_train]
    X_test_df = X.iloc[idx_test]

    rf_pipe = Pipeline(
        [
            ("prep", build_preprocessor(cat_categories_list)),
            ("clf", RandomForestClassifier(n_estimators=400, max_depth=None, random_state=42, class_weight="balanced_subsample")),
        ]
    )
    rf_pipe.fit(X_train_df, y_train)
    y_pred_rf = rf_pipe.predict(X_test_df)
    acc_rf = float(accuracy_score(y_test, y_pred_rf))

    hgb_pipe_m = Pipeline(
        [
            ("prep", build_preprocessor(cat_categories_list)),
            (
                "clf",
                HistGradientBoostingClassifier(max_depth=10, learning_rate=0.06, max_iter=450, random_state=42),
            ),
        ]
    )
    hgb_pipe_m.fit(X_train_df, y_train)
    acc_hgb_holdout = float(accuracy_score(y_test, hgb_pipe_m.predict(X_test_df)))

    final_pipe = Pipeline(
        [
            ("prep", build_preprocessor(cat_categories_list)),
            (
                "clf",
                HistGradientBoostingClassifier(max_depth=10, learning_rate=0.06, max_iter=450, random_state=42),
            ),
        ]
    )
    final_pipe.fit(X, y)

    prep: ColumnTransformer = final_pipe.named_steps["prep"]
    X_t = prep.transform(X)
    cities = sorted(y.unique().tolist())

    centroids: dict[str, list[float]] = {}
    for city in cities:
        mask = y.values == city
        if mask.sum() == 0:
            continue
        centroids[city] = np.mean(X_t[mask], axis=0).astype(float).tolist()

    num_scaler: StandardScaler = prep.named_transformers_["num"]
    num_mean = num_scaler.mean_.tolist()
    num_scale = num_scaler.scale_.tolist()

    def centroid_predict(Xm: np.ndarray) -> np.ndarray:
        out = []
        for row in Xm:
            best_c, best_s = None, -1.0
            for c, vec in centroids.items():
                v = np.array(vec, dtype=float)
                s = cos_sim(row, v)
                if s > best_s:
                    best_s, best_c = s, c
            out.append(best_c)
        return np.array(out)

    centroid_acc = float(accuracy_score(y_test.values, centroid_predict(X_t[idx_test])))

    priors = (y.value_counts(normalize=True).reindex(cities).fillna(0)).tolist()

    payload = {
        "schemaVersion": 1,
        "trainedOnRows": int(len(df)),
        "cities": cities,
        "categoricalColumns": CATEGORICAL,
        "numericColumns": NUMERIC,
        "categories": cat_categories,
        "numericMean": num_mean,
        "numericScale": num_scale,
        "centroids": centroids,
        "cityPriors": {cities[i]: priors[i] for i in range(len(cities))},
        "metrics": {
            "randomForestHoldoutAccuracy": round(acc_rf, 4),
            "histGradientBoostingHoldoutAccuracy": round(acc_hgb_holdout, 4),
            "centroidTop1Accuracy": round(centroid_acc, 4),
        },
        "notes": classification_report(y_test, y_pred_rf, zero_division=0)[:2000],
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    JOBLIB_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_pipe, JOBLIB_PATH)

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {JOBLIB_PATH}")
    print(f"RandomForest holdout accuracy: {acc_rf:.4f}")
    print(f"HistGradientBoosting holdout accuracy: {acc_hgb_holdout:.4f}")
    print(f"Centroid cosine top-1 accuracy (same split): {centroid_acc:.4f}")
    print(classification_report(y_test, y_pred_rf, zero_division=0))


if __name__ == "__main__":
    main()
