#!/usr/bin/env python3
"""
Train the new multi-target recommendation model from yallatn_recommendations_dataset.csv.

Targets used (as requested):
- recommended_city_id
- recommended_city_name
- recommended_region
- recommended_activities
- recommended_event

Exports:
- frontend/src/assets/travel-match-model.json   (schema v2 static fallback data)
- travel-recommendation/model_bundle.joblib     (Flask API inference bundle)

Run:
  python scripts/train_travel_match_model.py
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from math import log2

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "frontend" / "src" / "assets" / "yallatn_recommendations_dataset.csv"
CSV_PATH = Path(os.environ.get("TRAVEL_MATCH_CSV", str(DEFAULT_CSV))).resolve()
OUT_JSON = ROOT / "frontend" / "src" / "assets" / "travel-match-model.json"
JOBLIB_PATH = ROOT / "travel-recommendation" / "model_bundle.joblib"

FEATURE_CATEGORICAL = [
    "accommodation_type",
    "preferred_cuisine",
    "preferred_region",
    "transport_preference",
    "travel_style",
    "travel_with",
]
FEATURE_NUMERIC = ["budget_min", "budget_max"]

TARGET_COLUMNS = [
    "recommended_city_id",
    "recommended_city_name",
    "recommended_region",
    "recommended_activities",
    "recommended_event",
]

CITY_TARGET = "recommended_city_name"
MAX_STATIC_PROFILES = int(os.environ.get("TRAVEL_MATCH_MAX_STATIC_PROFILES", "4000"))
RANDOM_STATE = 42
MAX_TRAIN_ROWS = int(os.environ.get("TRAVEL_MATCH_MAX_TRAIN_ROWS", "50000"))

REGION_ALIASES = {
    "nord": "north",
    "north": "north",
    "north coast": "north",
    "capital": "north",
    "centre": "center",
    "center": "center",
    "central": "center",
    "sud": "south",
    "south": "south",
    "desert": "south",
    "any": "any",
}

STYLE_ALIASES = {
    "city break": "city",
    "citytrip": "city",
    "historical": "history",
    "heritage": "history",
    "adventurous": "adventure",
    "desert trip": "desert",
    "beach holiday": "beach",
    "lux": "luxury",
}


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    return " ".join(text.split())


def normalize_travel_style(value: object) -> str:
    raw = normalize_text(value)
    if not raw:
        return ""
    parts = []
    for p in raw.split("|"):
        token = STYLE_ALIASES.get(p.strip(), p.strip())
        if token:
            parts.append(token)
    if not parts:
        return ""
    parts = sorted(set(parts))
    return "|".join(parts)


def normalize_region(value: object) -> str:
    raw = normalize_text(value)
    if not raw:
        return ""
    return REGION_ALIASES.get(raw, raw)


def mode_or_empty(series: pd.Series) -> str:
    s = series.dropna()
    if s.empty:
        return ""
    return str(s.mode(dropna=True).iloc[0])


def ndcg_at_k(rank: int, k: int) -> float:
    if rank <= 0 or rank > k:
        return 0.0
    return 1.0 / log2(rank + 1)


def ranking_metrics(y_true: list[str], classes: list[str], probas: np.ndarray, top_k: int = 5) -> dict[str, float]:
    class_to_idx = {c: i for i, c in enumerate(classes)}
    total = max(1, len(y_true))
    top1 = top3 = top5 = 0
    reciprocal_ranks = []
    ndcgs = []
    for row_idx, label in enumerate(y_true):
        truth_idx = class_to_idx.get(label)
        if truth_idx is None:
            reciprocal_ranks.append(0.0)
            ndcgs.append(0.0)
            continue
        order = np.argsort(probas[row_idx])[::-1]
        rank_position = 0
        for pos, idx in enumerate(order, start=1):
            if idx == truth_idx:
                rank_position = pos
                break
        if rank_position == 1:
            top1 += 1
        if 0 < rank_position <= 3:
            top3 += 1
        if 0 < rank_position <= top_k:
            top5 += 1
        reciprocal_ranks.append((1.0 / rank_position) if rank_position > 0 else 0.0)
        ndcgs.append(ndcg_at_k(rank_position, top_k))

    return {
        "top1": float(top1 / total),
        "top3": float(top3 / total),
        "top5": float(top5 / total),
        "mrr": float(np.mean(reciprocal_ranks)),
        "ndcg5": float(np.mean(ndcgs)),
    }


def retrieval_score_map(row: dict[str, object], profiles: list[dict[str, object]]) -> dict[str, float]:
    result_max: dict[str, float] = {}
    result_sum: dict[str, float] = {}
    result_count: dict[str, int] = {}
    r_mid = (float(row.get("budget_min", 0.0)) + float(row.get("budget_max", 0.0))) / 2.0

    for p in profiles:
        score = 0.0
        score += 1.0 if normalize_text(p.get("accommodation_type")) == normalize_text(row.get("accommodation_type")) else 0.0
        score += 1.0 if normalize_text(p.get("preferred_cuisine")) == normalize_text(row.get("preferred_cuisine")) else 0.0
        score += 1.4 if normalize_region(p.get("preferred_region")) == normalize_region(row.get("preferred_region")) else 0.0
        score += 1.0 if normalize_text(p.get("transport_preference")) == normalize_text(row.get("transport_preference")) else 0.0
        score += 1.2 if normalize_travel_style(p.get("travel_style")) == normalize_travel_style(row.get("travel_style")) else 0.0
        score += 1.0 if normalize_text(p.get("travel_with")) == normalize_text(row.get("travel_with")) else 0.0
        p_mid = (float(p.get("budget_min", 0.0)) + float(p.get("budget_max", 0.0))) / 2.0
        score += max(0.0, 1.2 - (abs(r_mid - p_mid) / 250.0))
        city = normalize_text(p.get("city"))
        if not city:
            continue
        result_max[city] = max(result_max.get(city, -1.0), score)
        result_sum[city] = result_sum.get(city, 0.0) + score
        result_count[city] = result_count.get(city, 0) + 1

    if not result_max:
        return {}
    combined: dict[str, float] = {}
    for city, best_score in result_max.items():
        avg_score = result_sum.get(city, 0.0) / max(1, result_count.get(city, 1))
        support = min(1.0, result_count.get(city, 0) / 6.0)
        combined[city] = (best_score * 0.62) + (avg_score * 0.23) + (support * 0.15)
    max_score = max(combined.values()) or 1.0
    return {k: float(v / max_score) for k, v in combined.items()}


def exact_city_match(row: dict[str, object], profiles: list[dict[str, object]]) -> str:
    counts: dict[str, int] = {}
    for p in profiles:
        if normalize_text(p.get("accommodation_type")) != normalize_text(row.get("accommodation_type")):
            continue
        if normalize_text(p.get("preferred_cuisine")) != normalize_text(row.get("preferred_cuisine")):
            continue
        if normalize_region(p.get("preferred_region")) != normalize_region(row.get("preferred_region")):
            continue
        if normalize_text(p.get("transport_preference")) != normalize_text(row.get("transport_preference")):
            continue
        if normalize_travel_style(p.get("travel_style")) != normalize_travel_style(row.get("travel_style")):
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


def categories_for_columns(df: pd.DataFrame) -> list[list[str]]:
    out: list[list[str]] = []
    for col in FEATURE_CATEGORICAL:
        out.append(sorted(df[col].dropna().astype(str).str.strip().str.lower().unique().tolist()))
    return out


def build_preprocessor(cat_categories_list: list[list[str]]) -> ColumnTransformer:
    return ColumnTransformer(
        [
            (
                "cat",
                OneHotEncoder(categories=cat_categories_list, handle_unknown="ignore", sparse_output=False),
                FEATURE_CATEGORICAL,
            ),
            ("num", StandardScaler(), FEATURE_NUMERIC),
        ]
    )


def main() -> None:
    if not CSV_PATH.is_file():
        raise SystemExit(f"CSV not found: {CSV_PATH}")

    print(f"[train] Loading dataset: {CSV_PATH}", flush=True)
    df = pd.read_csv(CSV_PATH)
    for col in FEATURE_CATEGORICAL + TARGET_COLUMNS:
        if col not in df.columns:
            raise SystemExit(f"Missing required column '{col}' in {CSV_PATH.name}")

    for col in FEATURE_CATEGORICAL:
        if col == "travel_style":
            df[col] = df[col].map(normalize_travel_style)
        elif col == "preferred_region":
            df[col] = df[col].map(normalize_region)
        else:
            df[col] = df[col].map(normalize_text)

    for col in FEATURE_NUMERIC:
        if col not in df.columns:
            raise SystemExit(f"Missing numeric feature '{col}' in {CSV_PATH.name}")
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=FEATURE_NUMERIC + TARGET_COLUMNS)
    if df.empty:
        raise SystemExit("No usable rows after cleaning dataset")

    # Normalize targets to consistent text ids.
    df["recommended_city_id"] = pd.to_numeric(df["recommended_city_id"], errors="coerce").fillna(-1).astype(int).astype(str)
    for col in ["recommended_city_name", "recommended_activities", "recommended_event"]:
        df[col] = df[col].map(normalize_text)
    df["recommended_region"] = df["recommended_region"].map(normalize_region)

    # Resolve contradictory duplicated preference rows by keeping the dominant label tuple.
    pre_dedup_rows = len(df)
    key_cols = FEATURE_CATEGORICAL + FEATURE_NUMERIC
    collapsed = (
        df.groupby(key_cols, dropna=False, as_index=False)
        .agg({
            "recommended_city_id": mode_or_empty,
            "recommended_city_name": mode_or_empty,
            "recommended_region": mode_or_empty,
            "recommended_activities": mode_or_empty,
            "recommended_event": mode_or_empty,
        })
    )
    collapsed["row_weight"] = 1
    df = collapsed.copy()
    post_dedup_rows = len(df)
    print(f"[train] Dedup rows: {pre_dedup_rows} -> {post_dedup_rows}", flush=True)

    if len(df) > MAX_TRAIN_ROWS:
        per_city = max(1, MAX_TRAIN_ROWS // max(1, df["recommended_city_name"].nunique()))
        sample_chunks = []
        for _, g in df.groupby("recommended_city_name", sort=False):
            take = min(len(g), per_city)
            sample_chunks.append(g.sample(n=take, random_state=RANDOM_STATE, replace=False))
        df = pd.concat(sample_chunks, ignore_index=True)
        if len(df) > MAX_TRAIN_ROWS:
            df = df.sample(n=MAX_TRAIN_ROWS, random_state=RANDOM_STATE, replace=False)
    sampled_rows = len(df)
    print(f"[train] Rows used for training: {sampled_rows}", flush=True)

    X = df[FEATURE_CATEGORICAL + FEATURE_NUMERIC].copy()
    Y = df[TARGET_COLUMNS].copy()
    y_city = Y[CITY_TARGET].copy()

    cat_categories_list = categories_for_columns(df)
    preprocessor = build_preprocessor(cat_categories_list)

    idx_all = np.arange(len(df))
    idx_train_val, idx_test = train_test_split(
        idx_all,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=y_city,
    )

    X_train_val = X.iloc[idx_train_val]
    y_city_train_val = y_city.iloc[idx_train_val]

    idx_train, idx_val = train_test_split(
        np.arange(len(X_train_val)),
        test_size=0.25,
        random_state=RANDOM_STATE,
        stratify=y_city_train_val,
    )

    X_train = X_train_val.iloc[idx_train]
    y_city_train = y_city_train_val.iloc[idx_train]
    X_val = X_train_val.iloc[idx_val]
    y_city_val = y_city_train_val.iloc[idx_val]

    X_test = X.iloc[idx_test]
    y_city_test = y_city.iloc[idx_test]

    search_space = [
        {"n_estimators": 120, "max_depth": 18, "min_samples_leaf": 1, "max_features": "sqrt"},
        {"n_estimators": 140, "max_depth": 22, "min_samples_leaf": 2, "max_features": "sqrt"},
        {"n_estimators": 180, "max_depth": None, "min_samples_leaf": 2, "max_features": "log2"},
        {"n_estimators": 160, "max_depth": 16, "min_samples_leaf": 1, "max_features": None},
    ]
    best_params = search_space[0]
    best_score = -1.0
    best_val_ranking = {}

    for params in search_space:
        print(f"[train] Evaluating params: {params}", flush=True)
        candidate = Pipeline(
            [
                ("prep", preprocessor),
                (
                    "clf",
                    RandomForestClassifier(
                        n_estimators=params["n_estimators"],
                        random_state=RANDOM_STATE,
                        n_jobs=-1,
                        class_weight="balanced_subsample",
                        min_samples_leaf=params["min_samples_leaf"],
                        max_depth=params["max_depth"],
                        max_features=params["max_features"],
                    ),
                ),
            ]
        )
        candidate.fit(X_train, y_city_train)
        val_proba = candidate.predict_proba(X_val)
        val_classes = [str(c) for c in candidate.named_steps["clf"].classes_]
        val_metrics = ranking_metrics(y_city_val.tolist(), val_classes, val_proba, top_k=5)
        objective = (val_metrics["top5"] * 0.65) + (val_metrics["mrr"] * 0.25) + (val_metrics["ndcg5"] * 0.10)
        if objective > best_score:
            best_score = objective
            best_params = params
            best_val_ranking = val_metrics
    print(f"[train] Best params: {best_params} | val_top5={best_val_ranking.get('top5', 0):.4f}", flush=True)

    holdout_city_pipe = Pipeline(
        [
            ("prep", build_preprocessor(cat_categories_list)),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=best_params["n_estimators"],
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                    class_weight="balanced_subsample",
                    min_samples_leaf=best_params["min_samples_leaf"],
                    max_depth=best_params["max_depth"],
                    max_features=best_params["max_features"],
                ),
            ),
        ]
    )
    holdout_city_pipe.fit(X_train_val, y_city_train_val)
    city_pred = holdout_city_pipe.predict(X_test)
    city_acc = float(accuracy_score(y_city_test, city_pred))
    city_proba = holdout_city_pipe.predict_proba(X_test)
    city_classes = [str(c) for c in holdout_city_pipe.named_steps["clf"].classes_]
    test_ranking = ranking_metrics(y_city_test.tolist(), city_classes, city_proba, top_k=5)

    # Blend tuning on validation set, then report on test set.
    retrieval_profiles_train = [
        {
            "accommodation_type": str(r["accommodation_type"]),
            "preferred_cuisine": str(r["preferred_cuisine"]),
            "preferred_region": str(r["preferred_region"]),
            "transport_preference": str(r["transport_preference"]),
            "travel_style": str(r["travel_style"]),
            "travel_with": str(r["travel_with"]),
            "budget_min": float(r["budget_min"]),
            "budget_max": float(r["budget_max"]),
            "city": str(r["recommended_city_name"]),
        }
        for _, r in pd.concat([X_train.reset_index(drop=True), y_city_train.reset_index(drop=True)], axis=1)
        .rename(columns={CITY_TARGET: "recommended_city_name"})
        .iterrows()
    ]
    city_to_region = (
        pd.concat([X_train_val.reset_index(drop=True), Y.iloc[idx_train_val].reset_index(drop=True)], axis=1)
        .groupby("recommended_city_name")["recommended_region"]
        .agg(mode_or_empty)
        .to_dict()
    )
    blend_space = [
        {"model_weight": 0.72, "retrieval_weight": 0.28, "region_match_boost": 1.10, "region_mismatch_penalty": 0.96, "exact_match_boost": 1.35},
        {"model_weight": 0.67, "retrieval_weight": 0.33, "region_match_boost": 1.14, "region_mismatch_penalty": 0.94, "exact_match_boost": 1.50},
        {"model_weight": 0.63, "retrieval_weight": 0.37, "region_match_boost": 1.15, "region_mismatch_penalty": 0.92, "exact_match_boost": 1.65},
        {"model_weight": 0.58, "retrieval_weight": 0.42, "region_match_boost": 1.18, "region_mismatch_penalty": 0.90, "exact_match_boost": 1.75},
    ]
    best_blend = blend_space[0]
    best_blend_score = -1.0
    val_probs = holdout_city_pipe.predict_proba(X_val)
    val_classes = [str(c) for c in holdout_city_pipe.named_steps["clf"].classes_]
    class_to_i = {c: i for i, c in enumerate(val_classes)}
    for blend in blend_space:
        hits_top5 = 0
        rr_vals: list[float] = []
        for row_idx, (_, row) in enumerate(X_val.iterrows()):
            row_dict = row.to_dict()
            retrieval = retrieval_score_map(row_dict, retrieval_profiles_train)
            exact_city = exact_city_match(row_dict, retrieval_profiles_train)
            preferred_region = normalize_region(row_dict.get("preferred_region"))
            combined_scores = []
            for city in val_classes:
                m_score = float(val_probs[row_idx][class_to_i[city]])
                r_score = float(retrieval.get(normalize_text(city), 0.0))
                score = blend["model_weight"] * m_score + blend["retrieval_weight"] * r_score
                if preferred_region and preferred_region != "any":
                    city_region = normalize_region(city_to_region.get(city, ""))
                    if city_region == preferred_region:
                        score *= blend["region_match_boost"]
                    else:
                        score *= blend["region_mismatch_penalty"]
                if exact_city and normalize_text(city) == exact_city:
                    score *= blend["exact_match_boost"]
                combined_scores.append((city, score))
            ordered = [c for c, _ in sorted(combined_scores, key=lambda x: x[1], reverse=True)]
            truth = str(y_city_val.iloc[row_idx])
            rank = (ordered.index(truth) + 1) if truth in ordered else 0
            if 0 < rank <= 5:
                hits_top5 += 1
            rr_vals.append((1.0 / rank) if rank > 0 else 0.0)
        top5 = hits_top5 / max(1, len(X_val))
        mrr = float(np.mean(rr_vals)) if rr_vals else 0.0
        objective = (top5 * 0.7) + (mrr * 0.3)
        if objective > best_blend_score:
            best_blend_score = objective
            best_blend = blend
    print(f"[train] Best blend: {best_blend}", flush=True)

    try:
        class_to_idx = {c: i for i, c in enumerate(city_classes)}
        y_test_codes = np.array([class_to_idx[label] for label in y_city_test.tolist()])
        city_auc_ovr = float(
            roc_auc_score(
                y_test_codes,
                city_proba,
                multi_class="ovr",
                average="macro",
            )
        )
    except Exception:
        city_auc_ovr = 0.0

    final_city_pipe = Pipeline(
        [
            ("prep", build_preprocessor(cat_categories_list)),
            (
                "clf",
                RandomForestClassifier(
                    n_estimators=best_params["n_estimators"],
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                    class_weight="balanced_subsample",
                    min_samples_leaf=best_params["min_samples_leaf"],
                    max_depth=best_params["max_depth"],
                    max_features=best_params["max_features"],
                ),
            ),
        ]
    )
    final_city_pipe.fit(X, y_city)

    prep: ColumnTransformer = final_city_pipe.named_steps["prep"]
    scaler: StandardScaler = prep.named_transformers_["num"]

    city_label_map: dict[str, dict[str, str]] = {}
    for city_name, group in Y.groupby(CITY_TARGET):
        mode_row = group.mode(dropna=True).iloc[0]
        city_label_map[city_name] = {
            "recommended_city_id": str(mode_row["recommended_city_id"]),
            "recommended_city_name": str(mode_row["recommended_city_name"]),
            "recommended_region": str(mode_row["recommended_region"]),
            "recommended_activities": str(mode_row["recommended_activities"]),
            "recommended_event": str(mode_row["recommended_event"]),
        }

    profiles_df = df
    if len(df) > MAX_STATIC_PROFILES:
        # Keep fallback JSON lightweight by sampling profiles while preserving city diversity.
        per_city = max(1, MAX_STATIC_PROFILES // max(1, len(city_label_map)))
        sampled_chunks = []
        for _, g in df.groupby("recommended_city_name", sort=False):
            take = min(len(g), per_city)
            sampled_chunks.append(g.sample(n=take, random_state=42, replace=False))
        profiles_df = pd.concat(sampled_chunks, ignore_index=True)
        if len(profiles_df) > MAX_STATIC_PROFILES:
            profiles_df = profiles_df.sample(n=MAX_STATIC_PROFILES, random_state=42, replace=False)

    static_profiles = []
    for _, row in profiles_df.iterrows():
        static_profiles.append(
            {
                "features": {
                    "accommodation_type": str(row["accommodation_type"]),
                    "preferred_cuisine": str(row["preferred_cuisine"]),
                    "preferred_region": str(row["preferred_region"]),
                    "transport_preference": str(row["transport_preference"]),
                    "travel_style": str(row["travel_style"]),
                    "travel_with": str(row["travel_with"]),
                    "budget_min": float(row["budget_min"]),
                    "budget_max": float(row["budget_max"]),
                },
                "labels": {
                    "recommended_city_id": str(row["recommended_city_id"]),
                    "recommended_city_name": str(row["recommended_city_name"]),
                    "recommended_region": str(row["recommended_region"]),
                    "recommended_activities": str(row["recommended_activities"]),
                    "recommended_event": str(row["recommended_event"]),
                },
            }
        )

    cat_categories: dict[str, list[str]] = {
        col: [str(c) for c in cat_categories_list[i]] for i, col in enumerate(FEATURE_CATEGORICAL)
    }

    payload = {
        "schemaVersion": 2,
        "trainedOnRows": int(len(df)),
        "staticProfilesRows": int(len(static_profiles)),
        "featureColumns": {
            "categorical": FEATURE_CATEGORICAL,
            "numeric": FEATURE_NUMERIC,
        },
        "targetColumns": TARGET_COLUMNS,
        "categories": cat_categories,
        "numericMean": [float(x) for x in scaler.mean_.tolist()],
        "numericScale": [float(x) for x in scaler.scale_.tolist()],
        "cityLabelMap": city_label_map,
        "profiles": static_profiles,
        "metrics": {
            "acc_recommended_city_name": round(city_acc, 4),
            "top1_acc_recommended_city_name": round(test_ranking["top1"], 4),
            "top3_acc_recommended_city_name": round(test_ranking["top3"], 4),
            "top5_acc_recommended_city_name": round(test_ranking["top5"], 4),
            "mrr_recommended_city_name": round(test_ranking["mrr"], 4),
            "ndcg5_recommended_city_name": round(test_ranking["ndcg5"], 4),
            "auc_ovr_recommended_city_name": round(city_auc_ovr, 4),
            "rows_before_dedup": int(pre_dedup_rows),
            "rows_after_dedup": int(post_dedup_rows),
            "rows_used_for_training": int(sampled_rows),
            "val_top5_best": round(best_val_ranking.get("top5", 0.0), 4),
        },
        "modelInfo": {
            "sklearnVersion": sklearn.__version__,
            "selectedHyperparameters": best_params,
            "rankingTuning": best_blend,
        },
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    city_target_index = TARGET_COLUMNS.index(CITY_TARGET)
    retrieval_profiles = [
        {
            "accommodation_type": str(r["accommodation_type"]),
            "preferred_cuisine": str(r["preferred_cuisine"]),
            "preferred_region": str(r["preferred_region"]),
            "transport_preference": str(r["transport_preference"]),
            "travel_style": str(r["travel_style"]),
            "travel_with": str(r["travel_with"]),
            "budget_min": float(r["budget_min"]),
            "budget_max": float(r["budget_max"]),
            "city": str(r["recommended_city_name"]),
        }
        for _, r in df.iterrows()
    ]

    bundle = {
        "schema_version": 2,
        "city_pipeline": final_city_pipe,
        "feature_columns": {
            "categorical": FEATURE_CATEGORICAL,
            "numeric": FEATURE_NUMERIC,
        },
        "target_columns": TARGET_COLUMNS,
        "city_target": CITY_TARGET,
        "city_target_index": city_target_index,
        "city_classes": sorted(city_label_map.keys()),
        "city_label_map": city_label_map,
        "retrieval_profiles": retrieval_profiles,
        "categories": cat_categories,
        "numeric_mean": [float(x) for x in scaler.mean_.tolist()],
        "numeric_scale": [float(x) for x in scaler.scale_.tolist()],
        "default_prediction": city_label_map[next(iter(city_label_map.keys()))],
        "metrics": payload["metrics"],
        "estimator": "random_forest_city",
        "sklearn_version": sklearn.__version__,
        "selected_hyperparameters": best_params,
        "ranking_tuning": best_blend,
    }

    JOBLIB_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, JOBLIB_PATH)

    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {JOBLIB_PATH}")
    print(json.dumps(payload["metrics"], indent=2))


if __name__ == "__main__":
    main()
