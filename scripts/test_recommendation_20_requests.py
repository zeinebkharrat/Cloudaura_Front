#!/usr/bin/env python3
"""Run 20 recommendation API requests and compute performance percentages."""

from __future__ import annotations

import statistics
import time
from math import log2
from pathlib import Path
import json
import os

import requests

API_URL = os.environ.get("TRAVEL_RECO_API_URL", "http://127.0.0.1:5050/api/recommend")
OUT_JSON = Path("scripts") / "recommendation_eval_latest.json"

TEST_CASES = [
    {"expected_city": "tunis", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "tunisian", "preferred_region": "north", "transport_preference": "car", "travel_styles": ["culture", "city"], "travel_with": "family", "budget_min": 120, "budget_max": 260, "topN": 5}},
    {"expected_city": "tunis", "payload": {"accommodation_type": "hostel", "preferred_cuisine": "street food", "preferred_region": "north", "transport_preference": "train", "travel_styles": ["budget", "city"], "travel_with": "friends", "budget_min": 50, "budget_max": 120, "topN": 5}},
    {"expected_city": "bizerte", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "seafood", "preferred_region": "north", "transport_preference": "car", "travel_styles": ["relax", "nature"], "travel_with": "couple", "budget_min": 100, "budget_max": 220, "topN": 5}},
    {"expected_city": "nabeul", "payload": {"accommodation_type": "guest house", "preferred_cuisine": "tunisian", "preferred_region": "north", "transport_preference": "car", "travel_styles": ["beach", "relax"], "travel_with": "family", "budget_min": 90, "budget_max": 210, "topN": 5}},
    {"expected_city": "jendouba", "payload": {"accommodation_type": "eco lodge", "preferred_cuisine": "tunisian", "preferred_region": "north", "transport_preference": "car", "travel_styles": ["nature", "adventure"], "travel_with": "friends", "budget_min": 80, "budget_max": 180, "topN": 5}},
    {"expected_city": "sousse", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "seafood", "preferred_region": "center", "transport_preference": "train", "travel_styles": ["beach", "city"], "travel_with": "couple", "budget_min": 110, "budget_max": 260, "topN": 5}},
    {"expected_city": "kairouan", "payload": {"accommodation_type": "guest house", "preferred_cuisine": "traditional", "preferred_region": "center", "transport_preference": "bus", "travel_styles": ["culture", "history"], "travel_with": "solo", "budget_min": 60, "budget_max": 140, "topN": 5}},
    {"expected_city": "monastir", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "seafood", "preferred_region": "center", "transport_preference": "car", "travel_styles": ["relax", "beach"], "travel_with": "family", "budget_min": 90, "budget_max": 200, "topN": 5}},
    {"expected_city": "mahdia", "payload": {"accommodation_type": "apartment", "preferred_cuisine": "seafood", "preferred_region": "center", "transport_preference": "car", "travel_styles": ["beach", "quiet"], "travel_with": "couple", "budget_min": 80, "budget_max": 170, "topN": 5}},
    {"expected_city": "sfax", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "tunisian", "preferred_region": "center", "transport_preference": "car", "travel_styles": ["business", "city"], "travel_with": "solo", "budget_min": 100, "budget_max": 240, "topN": 5}},
    {"expected_city": "tozeur", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "tunisian", "preferred_region": "south", "transport_preference": "car", "travel_styles": ["desert", "adventure"], "travel_with": "friends", "budget_min": 130, "budget_max": 320, "topN": 5}},
    {"expected_city": "douz", "payload": {"accommodation_type": "camp", "preferred_cuisine": "traditional", "preferred_region": "south", "transport_preference": "car", "travel_styles": ["desert", "adventure"], "travel_with": "couple", "budget_min": 120, "budget_max": 300, "topN": 5}},
    {"expected_city": "gabes", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "seafood", "preferred_region": "south", "transport_preference": "bus", "travel_styles": ["nature", "relax"], "travel_with": "family", "budget_min": 70, "budget_max": 170, "topN": 5}},
    {"expected_city": "medenine", "payload": {"accommodation_type": "guest house", "preferred_cuisine": "traditional", "preferred_region": "south", "transport_preference": "car", "travel_styles": ["culture", "history"], "travel_with": "solo", "budget_min": 60, "budget_max": 150, "topN": 5}},
    {"expected_city": "tataouine", "payload": {"accommodation_type": "camp", "preferred_cuisine": "tunisian", "preferred_region": "south", "transport_preference": "car", "travel_styles": ["desert", "adventure"], "travel_with": "friends", "budget_min": 90, "budget_max": 220, "topN": 5}},
    {"expected_city": "tunis", "payload": {"accommodation_type": "hotel", "preferred_cuisine": "international", "preferred_region": "any", "transport_preference": "flight", "travel_styles": ["luxury", "city"], "travel_with": "business", "budget_min": 250, "budget_max": 600, "topN": 5}},
    {"expected_city": "sousse", "payload": {"accommodation_type": "resort", "preferred_cuisine": "seafood", "preferred_region": "center", "transport_preference": "car", "travel_styles": ["beach", "family"], "travel_with": "family", "budget_min": 150, "budget_max": 350, "topN": 5}},
    {"expected_city": "tozeur", "payload": {"accommodation_type": "boutique hotel", "preferred_cuisine": "traditional", "preferred_region": "south", "transport_preference": "car", "travel_styles": ["nature", "desert"], "travel_with": "couple", "budget_min": 140, "budget_max": 330, "topN": 5}},
    {"expected_city": "nabeul", "payload": {"accommodation_type": "apartment", "preferred_cuisine": "tunisian", "preferred_region": "north", "transport_preference": "train", "travel_styles": ["beach", "budget"], "travel_with": "friends", "budget_min": 60, "budget_max": 130, "topN": 5}},
    {"expected_city": "kairouan", "payload": {"accommodation_type": "guest house", "preferred_cuisine": "traditional", "preferred_region": "center", "transport_preference": "bus", "travel_styles": ["history", "religious"], "travel_with": "family", "budget_min": 50, "budget_max": 120, "topN": 5}},
]


def norm(value: object) -> str:
    return str(value or "").strip().lower()


def ndcg_at_k(rank: int, k: int) -> float:
    """Single-relevant-item NDCG@k where rank is 1-based."""
    if rank <= 0 or rank > k:
        return 0.0
    return 1.0 / log2(rank + 1)


def main() -> None:
    total = len(TEST_CASES)
    ok_http = 0
    top1_hits = 0
    top2_hits = 0
    top3_hits = 0
    top5_hits = 0
    latencies_ms: list[float] = []
    top1_scores: list[float] = []
    expected_city_scores: list[float] = []
    reciprocal_ranks: list[float] = []
    expected_ranks: list[int] = []
    ndcg5_values: list[float] = []
    region_checks = 0
    region_hits = 0
    top1_predictions: list[str] = []
    errors: list[str] = []
    region_stats: dict[str, dict[str, int]] = {}

    print(f"Testing {total} requests against {API_URL}\n")

    for i, case in enumerate(TEST_CASES, start=1):
        expected = norm(case["expected_city"])
        payload = case["payload"]
        t0 = time.perf_counter()

        try:
            response = requests.post(API_URL, json=payload, timeout=15)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            latencies_ms.append(elapsed_ms)

            if response.status_code != 200:
                errors.append(f"Case {i}: HTTP {response.status_code}")
                print(f"[{i:02d}] HTTP {response.status_code} | {elapsed_ms:.1f} ms")
                continue

            ok_http += 1
            data = response.json()
            cities = data.get("cities", []) or []
            top1_city = norm(cities[0].get("recommended_city_name") if cities else "")
            top1_predictions.append(top1_city)
            top2_cities = [norm(item.get("recommended_city_name")) for item in cities[:2]]
            top3_cities = [norm(item.get("recommended_city_name")) for item in cities[:3]]
            top5_cities = [norm(item.get("recommended_city_name")) for item in cities[:5]]
            top1_score = float(cities[0].get("score01", 0.0)) if cities else 0.0
            top1_scores.append(top1_score)

            if expected == top1_city:
                top1_hits += 1
            if expected in top2_cities:
                top2_hits += 1
            if expected in top3_cities:
                top3_hits += 1
            if expected in top5_cities:
                top5_hits += 1

            found_rank = 0
            expected_city_score = 0.0
            for idx, item in enumerate(cities, start=1):
                city_name = norm(item.get("recommended_city_name"))
                if city_name == expected:
                    found_rank = idx
                    expected_city_score = float(item.get("score01", 0.0))
                    break

            expected_city_scores.append(expected_city_score)
            reciprocal_ranks.append((1.0 / found_rank) if found_rank > 0 else 0.0)
            expected_ranks.append(found_rank if found_rank > 0 else 999)
            ndcg5_values.append(ndcg_at_k(found_rank, 5))

            preferred_region = norm(payload.get("preferred_region"))
            if preferred_region and preferred_region != "any" and cities:
                region_checks += 1
                top1_region = norm(cities[0].get("recommended_region"))
                if top1_region == preferred_region:
                    region_hits += 1
            region_key = preferred_region if preferred_region else "unknown"
            if region_key not in region_stats:
                region_stats[region_key] = {"total": 0, "top1": 0, "top5": 0}
            region_stats[region_key]["total"] += 1
            if expected == top1_city:
                region_stats[region_key]["top1"] += 1
            if expected in top5_cities:
                region_stats[region_key]["top5"] += 1

            print(f"[{i:02d}] OK | {elapsed_ms:.1f} ms | expected={expected} | top1={top1_city} | score01={top1_score:.3f}")
        except Exception as exc:  # noqa: BLE001
            elapsed_ms = (time.perf_counter() - t0) * 1000
            latencies_ms.append(elapsed_ms)
            errors.append(f"Case {i}: {exc}")
            print(f"[{i:02d}] ERROR | {elapsed_ms:.1f} ms | {exc}")

    http_success_pct = (ok_http / total) * 100
    top1_acc_pct = (top1_hits / total) * 100
    top2_acc_pct = (top2_hits / total) * 100
    top3_acc_pct = (top3_hits / total) * 100
    top5_acc_pct = (top5_hits / total) * 100
    mean_latency = statistics.mean(latencies_ms) if latencies_ms else 0.0
    sorted_latencies = sorted(latencies_ms)
    p95_index = max(0, int(0.95 * len(sorted_latencies)) - 1) if sorted_latencies else 0
    p95_latency = sorted_latencies[p95_index] if sorted_latencies else 0.0
    p50_latency = statistics.median(sorted_latencies) if sorted_latencies else 0.0
    mean_top1_score_pct = (statistics.mean(top1_scores) * 100) if top1_scores else 0.0
    mean_expected_score_pct = (statistics.mean(expected_city_scores) * 100) if expected_city_scores else 0.0
    mrr_pct = (statistics.mean(reciprocal_ranks) * 100) if reciprocal_ranks else 0.0
    mean_rank = statistics.mean(expected_ranks) if expected_ranks else 0.0
    ndcg5_pct = (statistics.mean(ndcg5_values) * 100) if ndcg5_values else 0.0
    region_alignment_pct = ((region_hits / region_checks) * 100) if region_checks else 0.0
    unique_top1 = len(set(top1_predictions))
    top1_coverage_pct = (unique_top1 / total) * 100 if total else 0.0

    print("\n" + "=" * 68)
    print("MODEL PERFORMANCE SUMMARY")
    print("=" * 68)
    print(f"Total requests                  : {total}")
    print(f"HTTP success rate               : {http_success_pct:.2f}%")
    print(f"Top-1 accuracy                  : {top1_acc_pct:.2f}%")
    print(f"Top-2 accuracy                  : {top2_acc_pct:.2f}%")
    print(f"Top-3 accuracy                  : {top3_acc_pct:.2f}%")
    print(f"Top-5 accuracy                  : {top5_acc_pct:.2f}%")
    print(f"MRR (ranking quality)           : {mrr_pct:.2f}%")
    print(f"NDCG@5                          : {ndcg5_pct:.2f}%")
    print(f"Mean expected-city rank         : {mean_rank:.2f}")
    print(f"Expected-city mean score        : {mean_expected_score_pct:.2f}%")
    print(f"Mean top-1 confidence (score01) : {mean_top1_score_pct:.2f}%")
    print(f"Region alignment (top-1)        : {region_alignment_pct:.2f}%")
    print(f"Top-1 prediction coverage       : {top1_coverage_pct:.2f}% ({unique_top1}/{total})")
    print(f"P50 latency                     : {p50_latency:.1f} ms")
    print(f"Mean latency                    : {mean_latency:.1f} ms")
    print(f"P95 latency                     : {p95_latency:.1f} ms")
    print(f"Errors                          : {len(errors)}")
    if region_stats:
        print("\nPer-region slice metrics:")
        for region, rs in sorted(region_stats.items()):
            total_region = max(1, rs["total"])
            print(
                f"- {region}: top1={((rs['top1'] / total_region) * 100):.2f}% | "
                f"top5={((rs['top5'] / total_region) * 100):.2f}% | n={rs['total']}"
            )

    if errors:
        print("\nError details:")
        for err in errors:
            print(f"- {err}")

    output = {
        "api_url": API_URL,
        "total_requests": total,
        "metrics": {
            "http_success_pct": round(http_success_pct, 4),
            "top1_acc_pct": round(top1_acc_pct, 4),
            "top2_acc_pct": round(top2_acc_pct, 4),
            "top3_acc_pct": round(top3_acc_pct, 4),
            "top5_acc_pct": round(top5_acc_pct, 4),
            "mrr_pct": round(mrr_pct, 4),
            "ndcg5_pct": round(ndcg5_pct, 4),
            "mean_expected_rank": round(mean_rank, 4),
            "expected_city_mean_score_pct": round(mean_expected_score_pct, 4),
            "mean_top1_confidence_pct": round(mean_top1_score_pct, 4),
            "region_alignment_pct": round(region_alignment_pct, 4),
            "top1_prediction_coverage_pct": round(top1_coverage_pct, 4),
            "latency_p50_ms": round(p50_latency, 4),
            "latency_mean_ms": round(mean_latency, 4),
            "latency_p95_ms": round(p95_latency, 4),
        },
        "per_region": {
            region: {
                "count": stats["total"],
                "top1_acc_pct": round((stats["top1"] / max(1, stats["total"])) * 100, 4),
                "top5_acc_pct": round((stats["top5"] / max(1, stats["total"])) * 100, 4),
            }
            for region, stats in sorted(region_stats.items())
        },
        "errors": errors,
    }
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nSaved evaluation report: {OUT_JSON}")


if __name__ == "__main__":
    main()
