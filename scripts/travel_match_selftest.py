#!/usr/bin/env python3
"""
Print centroid-ranking sanity checks from real CSV rows (expected top city vs label).

Run from repo root: python scripts/travel_match_selftest.py

Use these preference payloads in the app (localStorage or wizard) to verify strong matches.
See scripts/TRAVEL_MATCH_TEST_EXAMPLES.md for JSON snippets.
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
_DEFAULT_CSV = ROOT / "frontend" / "src" / "assets" / "tunisian_travel_dataset_24c.csv"
CSV_PATH = Path(os.environ.get("TRAVEL_MATCH_CSV", str(_DEFAULT_CSV))).resolve()
MODEL_PATH = ROOT / "frontend" / "src" / "assets" / "travel-match-model.json"

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
TRAVEL_STYLE_ORDER = ["adventure", "beaches", "cultural", "luxury", "nature", "party", "relaxation"]


def categories_for_columns(df: pd.DataFrame) -> list[list[str]]:
    out: list[list[str]] = []
    for col in CATEGORICAL:
        if col == "travel_style":
            out.append(list(TRAVEL_STYLE_ORDER))
        else:
            vals = sorted(df[col].astype(str).str.strip().str.lower().unique().tolist())
            out.append(vals)
    return out


def cos_sim(a: np.ndarray, b: np.ndarray) -> float:
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na < 1e-9 or nb < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def encode_row(df: pd.DataFrame, preprocessor: ColumnTransformer, row: pd.Series) -> np.ndarray:
    single = pd.DataFrame([row[CATEGORICAL + NUMERIC].tolist()], columns=CATEGORICAL + NUMERIC)
    return preprocessor.transform(single)[0]


def main() -> None:
    df = pd.read_csv(CSV_PATH)
    df = df.dropna(subset=[TARGET])
    for c in CATEGORICAL:
        df[c] = df[c].astype(str).str.strip()
    cats = categories_for_columns(df)
    preprocessor = ColumnTransformer(
        [
            ("cat", OneHotEncoder(categories=cats, handle_unknown="ignore", sparse_output=False), CATEGORICAL),
            ("num", StandardScaler(), NUMERIC),
        ]
    )
    preprocessor.fit(df[CATEGORICAL + NUMERIC])
    y = df[TARGET].astype(str)

    model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    centroids = {k: np.array(v, dtype=float) for k, v in model["centroids"].items()}
    cities = model["cities"]

    # Pick a few labeled rows where label should rank well
    samples = [0, 1, 2, 10, 50, 100]
    print("--- Row reconstruction rank vs label city (top-1 centroid) ---")
    for i in samples:
        if i >= len(df):
            continue
        row = df.iloc[i]
        x = encode_row(df, preprocessor, row)
        label = row[TARGET]
        scored = [(c, cos_sim(x, centroids[c])) for c in cities if c in centroids]
        scored.sort(key=lambda t: -t[1])
        top = scored[0][0]
        rank_label = next((r + 1 for r, (c, _) in enumerate(scored) if c == label), None)
        print(f"row {i}: label={label} predicted_top={top} label_rank={rank_label} margin={scored[0][1]-scored[1][1]:.4f}")

    print("\n--- Example payloads copied from CSV rows (paste into browser prefs JSON) ---")
    for i in (0, 4, 7):
        row = df.iloc[i]
        payload = {
            "age": int(row["age"]),
            "gender": row["gender"],
            "nationality": row["nationality"],
            "current_city": row["current_city"],
            "travel_style": row["travel_style"],
            "travel_styles": [row["travel_style"]],
            "budget_level": row["budget_level"],
            "preferred_region": row["preferred_region"],
            "preferred_cuisine": row["preferred_cuisine"],
            "travel_with": row["travel_with"],
            "transport_preference": row["transport_preference"],
            "accommodation_type": row["accommodation_type"],
            "budget_avg": float(row["budget_avg"]),
            "is_group": int(row["is_group"]),
            "travel_intensity": row["travel_intensity"],
        }
        print(f"\n# CSV row index {i}, dataset target city = {row[TARGET]}")
        print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
