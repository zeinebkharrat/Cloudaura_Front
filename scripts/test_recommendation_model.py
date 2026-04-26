#!/usr/bin/env python3
"""Smoke-test city recommendation logic on 5 representative cities."""
from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BUNDLE_PATH = ROOT / "travel-recommendation" / "model_bundle.joblib"
CSV_PATH = ROOT / "frontend" / "src" / "assets" / "yallatn_recommendations_dataset.csv"

FEATURE_CATEGORICAL = [
    "accommodation_type",
    "preferred_cuisine",
    "preferred_region",
    "transport_preference",
    "travel_style",
    "travel_with",
]
FEATURE_NUMERIC = ["budget_min", "budget_max"]


def norm_text(v: object) -> str:
    return " ".join(str(v if v is not None else "").strip().lower().split())


def norm_style(v: object) -> str:
    raw = norm_text(v)
    if not raw:
        return ""
    return "|".join(sorted(set(x.strip() for x in raw.split("|") if x.strip())))


def main() -> None:
    bundle = joblib.load(BUNDLE_PATH)
    city_pipe = bundle["city_pipeline"]
    retrieval_profiles = bundle.get("retrieval_profiles", [])

    df = pd.read_csv(CSV_PATH)
    for c in FEATURE_CATEGORICAL:
        if c == "travel_style":
            df[c] = df[c].map(norm_style)
        else:
            df[c] = df[c].map(norm_text)

    for c in FEATURE_NUMERIC:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    df["recommended_city_name"] = df["recommended_city_name"].map(norm_text)
    df = df.dropna(subset=FEATURE_NUMERIC + ["recommended_city_name"]) 

    candidate_cities = ["tunis", "sousse", "tozeur", "kairouan", "gabes"]
    tests = []
    for city in candidate_cities:
        g = df[df["recommended_city_name"] == city]
        if g.empty:
            continue
        tests.append(g.sample(n=1, random_state=42).iloc[0])

    if len(tests) < 5:
        extra = df.sample(n=5 - len(tests), random_state=42)
        tests.extend([r for _, r in extra.iterrows()])

    def blended_predict_city(x_row: dict) -> str:
        X = pd.DataFrame([x_row])
        classes = [str(c) for c in city_pipe.named_steps["clf"].classes_]
        proba = city_pipe.predict_proba(X)[0]

        exact_counts: dict[str, int] = {}
        for p in retrieval_profiles:
            if norm_text(p.get("accommodation_type")) != norm_text(x_row.get("accommodation_type")):
                continue
            if norm_text(p.get("preferred_cuisine")) != norm_text(x_row.get("preferred_cuisine")):
                continue
            if norm_text(p.get("preferred_region")) != norm_text(x_row.get("preferred_region")):
                continue
            if norm_text(p.get("transport_preference")) != norm_text(x_row.get("transport_preference")):
                continue
            if norm_text(p.get("travel_style")) != norm_text(x_row.get("travel_style")):
                continue
            if norm_text(p.get("travel_with")) != norm_text(x_row.get("travel_with")):
                continue
            if float(p.get("budget_min", -1.0)) != float(x_row.get("budget_min", -2.0)):
                continue
            if float(p.get("budget_max", -1.0)) != float(x_row.get("budget_max", -2.0)):
                continue
            city = norm_text(p.get("city"))
            if city:
                exact_counts[city] = exact_counts.get(city, 0) + 1

        exact_city = max(exact_counts.items(), key=lambda kv: kv[1])[0] if exact_counts else ""

        r_mid = (float(x_row["budget_min"]) + float(x_row["budget_max"])) / 2.0
        retrieval_scores: dict[str, float] = {}
        for p in retrieval_profiles:
            score = 0.0
            score += 1.0 if norm_text(p.get("accommodation_type")) == norm_text(x_row.get("accommodation_type")) else 0.0
            score += 1.0 if norm_text(p.get("preferred_cuisine")) == norm_text(x_row.get("preferred_cuisine")) else 0.0
            score += 1.4 if norm_text(p.get("preferred_region")) == norm_text(x_row.get("preferred_region")) else 0.0
            score += 1.0 if norm_text(p.get("transport_preference")) == norm_text(x_row.get("transport_preference")) else 0.0
            score += 1.2 if norm_text(p.get("travel_style")) == norm_text(x_row.get("travel_style")) else 0.0
            score += 1.0 if norm_text(p.get("travel_with")) == norm_text(x_row.get("travel_with")) else 0.0
            p_mid = (float(p.get("budget_min", 0.0)) + float(p.get("budget_max", 0.0))) / 2.0
            score += max(0.0, 1.2 - (abs(r_mid - p_mid) / 250.0))
            city = norm_text(p.get("city"))
            if city:
                retrieval_scores[city] = max(retrieval_scores.get(city, 0.0), score)

        if retrieval_scores:
            mx = max(retrieval_scores.values()) or 1.0
            retrieval_scores = {k: v / mx for k, v in retrieval_scores.items()}

        best_city = ""
        best_score = -1.0
        for i, c in enumerate(classes):
            m = float(proba[i])
            r = float(retrieval_scores.get(norm_text(c), 0.0))
            s = (0.58 * m) + (0.42 * r)
            if exact_city and norm_text(c) == exact_city:
                s *= 1.65
            if s > best_score:
                best_score = s
                best_city = c
        return best_city

    passed = 0
    print("=== 5-city logical recommendation test ===")
    for i, row in enumerate(tests[:5], start=1):
        x_row = {
            "accommodation_type": row["accommodation_type"],
            "preferred_cuisine": row["preferred_cuisine"],
            "preferred_region": row["preferred_region"],
            "transport_preference": row["transport_preference"],
            "travel_style": row["travel_style"],
            "travel_with": row["travel_with"],
            "budget_min": float(row["budget_min"]),
            "budget_max": float(row["budget_max"]),
        }
        expected = str(row["recommended_city_name"])
        pred = blended_predict_city(x_row)
        ok = pred == expected
        if ok:
            passed += 1
        print(f"Case {i}: expected={expected} predicted={pred} -> {'OK' if ok else 'MISS'}")

    print(f"Passed {passed}/5")


if __name__ == "__main__":
    main()
