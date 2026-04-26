#!/usr/bin/env python3
"""
Generate a logical synthetic travel dataset with 24 Tunisian destination cities (governorate anchors).

Rows are mostly consistent: target `city` is drawn from the intersection of
`preferred_region` + `travel_style` (+ light noise) so ML models can reach high accuracy.

Output: frontend/src/assets/tunisian_travel_dataset_24c.csv

Run: python scripts/generate_tunisia_travel_dataset.py [--rows 4800]
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT_PATH = ROOT / "frontend" / "src" / "assets" / "tunisian_travel_dataset_24c.csv"

# 24 governorates represented by their main tourism / admin city name (matches resolveCityByName style).
CITIES_24 = [
    "Tunis",
    "Ariana",
    "Ben Arous",
    "Manouba",
    "Nabeul",
    "Zaghouan",
    "Bizerte",
    "Beja",
    "Jendouba",
    "Le Kef",
    "Siliana",
    "Sousse",
    "Monastir",
    "Mahdia",
    "Kairouan",
    "Kasserine",
    "Sidi Bouzid",
    "Gafsa",
    "Tozeur",
    "Kebili",
    "Gabes",
    "Medenine",
    "Tataouine",
    "Sfax",
]

TRAVEL_STYLES = ["adventure", "beaches", "cultural", "luxury", "nature", "party", "relaxation"]

GENDERS = ["female", "male"]
NATIONALITIES = ["tunisian", "arab", "african", "european", "other"]
BUDGET_LEVELS = ["low", "medium", "high"]
REGIONS = ["north", "coastal", "inland", "south", "desert"]
CUISINES = ["tunisian", "mediterranean", "middle_eastern", "european", "african", "american", "asian", "indian"]
TRAVEL_WITH = ["solo", "couple", "family", "friends"]
TRANSPORTS = ["car", "public", "plane"]
ACCOMMODATIONS = ["hotel", "resort", "airbnb", "hostel"]
INTENSITIES = ["low", "medium", "high"]

# Primary regional pools (logical geography)
REGION_POOL: dict[str, list[str]] = {
    "north": ["Tunis", "Ariana", "Ben Arous", "Manouba", "Bizerte", "Beja", "Jendouba", "Le Kef", "Siliana", "Zaghouan"],
    "coastal": ["Nabeul", "Sousse", "Monastir", "Mahdia", "Sfax", "Gabes", "Bizerte"],
    "inland": ["Kairouan", "Kasserine", "Sidi Bouzid", "Gafsa", "Siliana", "Le Kef", "Zaghouan"],
    "south": ["Gabes", "Medenine", "Tataouine", "Kebili", "Tozeur", "Sfax"],
    "desert": ["Tozeur", "Kebili", "Tataouine", "Medenine"],
}

# Style hints (tourism semantics). Use only names from CITIES_24.
STYLE_POOL: dict[str, list[str]] = {
    "beaches": ["Nabeul", "Mahdia", "Monastir", "Sousse", "Sfax", "Gabes", "Bizerte"],
    "cultural": ["Tunis", "Kairouan", "Le Kef", "Mahdia", "Sousse", "Monastir"],
    "luxury": ["Tunis", "Sousse", "Nabeul"],
    "nature": ["Zaghouan", "Jendouba", "Siliana", "Le Kef", "Bizerte"],
    "adventure": ["Tozeur", "Tataouine", "Medenine", "Kairouan", "Gafsa"],
    "party": ["Tunis", "Sousse", "Sfax", "Nabeul"],
    "relaxation": ["Mahdia", "Monastir", "Sousse", "Medenine"],
}


def regions_for_city(city: str) -> list[str]:
    return [r for r, cities in REGION_POOL.items() if city in cities]


def styles_for_city(city: str) -> list[str]:
    return [s for s, cities in STYLE_POOL.items() if city in cities]


def _pool_for_row(region: str, style: str) -> list[str]:
    rp = set(REGION_POOL.get(region, CITIES_24))
    sp = set(STYLE_POOL.get(style, CITIES_24))
    inter = sorted(rp & sp)
    if inter:
        return inter
    uni = sorted(rp | sp)
    return uni if uni else CITIES_24.copy()


# Deterministic anchor: recommended city is almost always this for (region, travel_style).
# Keeps synthetic labels strongly learnable while still covering all 24 cities across the grid.
PAIR_TO_CITY: dict[tuple[str, str], str] = {
    # North — includes Béja / Zaghouan / Tunis metro anchors
    ("north", "adventure"): "Beja",
    ("north", "beaches"): "Bizerte",
    ("north", "cultural"): "Tunis",
    ("north", "luxury"): "Manouba",
    ("north", "nature"): "Jendouba",
    ("north", "party"): "Ben Arous",
    ("north", "relaxation"): "Ariana",
    # Coastal / central coast
    ("coastal", "adventure"): "Sfax",
    ("coastal", "beaches"): "Sousse",
    ("coastal", "cultural"): "Monastir",
    ("coastal", "luxury"): "Nabeul",
    ("coastal", "nature"): "Mahdia",
    ("coastal", "party"): "Zaghouan",
    ("coastal", "relaxation"): "Mahdia",
    # Inland
    ("inland", "adventure"): "Gafsa",
    ("inland", "beaches"): "Sfax",
    ("inland", "cultural"): "Kairouan",
    ("inland", "luxury"): "Le Kef",
    ("inland", "nature"): "Siliana",
    ("inland", "party"): "Sidi Bouzid",
    ("inland", "relaxation"): "Kasserine",
    # South
    ("south", "adventure"): "Tataouine",
    ("south", "beaches"): "Gabes",
    ("south", "cultural"): "Medenine",
    ("south", "luxury"): "Gabes",
    ("south", "nature"): "Kebili",
    ("south", "party"): "Sfax",
    ("south", "relaxation"): "Gabes",
    # Desert / gateway oases
    ("desert", "adventure"): "Tozeur",
    ("desert", "beaches"): "Kebili",
    ("desert", "cultural"): "Tozeur",
    ("desert", "luxury"): "Tozeur",
    ("desert", "nature"): "Kebili",
    ("desert", "party"): "Tozeur",
    ("desert", "relaxation"): "Kebili",
}


_cov = set(PAIR_TO_CITY.values())
_missing_in_pairs = set(CITIES_24) - _cov
assert not _missing_in_pairs, f"PAIR_TO_CITY must mention every city in CITIES_24 — missing {_missing_in_pairs}"
assert len(PAIR_TO_CITY) == len(REGIONS) * len(TRAVEL_STYLES)


def assign_city(rng: random.Random, region: str, style: str, noise_rate: float) -> str:
    pair = (region, style)
    base = PAIR_TO_CITY.get(pair)
    if base is None:
        pool = _pool_for_row(region, style)
        base = rng.choice(pool)
    if rng.random() < noise_rate:
        return rng.choice(CITIES_24)
    return base


def force_row_for_city(rng: random.Random, city: str) -> dict:
    """Synthetic row guaranteed to label `city`, with coherent region/style when possible."""
    regs = regions_for_city(city)
    stys = styles_for_city(city)
    preferred_region = rng.choice(regs if regs else REGIONS)
    travel_style = rng.choice(stys if stys else TRAVEL_STYLES)
    gender = rng.choice(GENDERS)
    nationality = rng.choice(NATIONALITIES)
    budget_level = rng.choice(BUDGET_LEVELS)
    preferred_cuisine = rng.choice(CUISINES)
    travel_with = rng.choice(TRAVEL_WITH)
    transport_preference = rng.choice(TRANSPORTS)
    accommodation_type = rng.choice(ACCOMMODATIONS)
    travel_intensity = rng.choice(INTENSITIES)
    age = int(rng.gauss(38, 14))
    age = max(18, min(85, age))
    budget_avg = float(max(40, min(650, rng.gauss(160, 90))))
    is_group = rng.randint(0, 1)
    current_city = rng.choice([c for c in CITIES_24 if c != city] or CITIES_24)
    return {
        "age": age,
        "gender": gender,
        "nationality": nationality,
        "current_city": current_city,
        "travel_style": travel_style,
        "budget_level": budget_level,
        "preferred_region": preferred_region,
        "preferred_cuisine": preferred_cuisine,
        "travel_with": travel_with,
        "transport_preference": transport_preference,
        "accommodation_type": accommodation_type,
        "budget_avg": round(budget_avg, 1),
        "is_group": is_group,
        "travel_intensity": travel_intensity,
        "city": city,
    }


def ensure_city_coverage(df: pd.DataFrame, rng: random.Random, min_per_city: int = 72) -> pd.DataFrame:
    counts = df["city"].value_counts()
    extra: list[dict] = []
    for city in CITIES_24:
        n = int(counts.get(city, 0))
        while n < min_per_city:
            extra.append(force_row_for_city(rng, city))
            n += 1
    if not extra:
        return df
    return pd.concat([df, pd.DataFrame(extra)], ignore_index=True)


def random_row(rng: random.Random, noise_rate: float) -> dict:
    gender = rng.choice(GENDERS)
    nationality = rng.choice(NATIONALITIES)
    travel_style = rng.choice(TRAVEL_STYLES)
    budget_level = rng.choice(BUDGET_LEVELS)
    preferred_region = rng.choice(REGIONS)
    preferred_cuisine = rng.choice(CUISINES)
    travel_with = rng.choice(TRAVEL_WITH)
    transport_preference = rng.choice(TRANSPORTS)
    accommodation_type = rng.choice(ACCOMMODATIONS)
    travel_intensity = rng.choice(INTENSITIES)
    age = int(rng.gauss(40, 14))
    age = max(18, min(85, age))
    budget_avg = float(max(40, min(650, rng.gauss(160, 90))))
    is_group = rng.randint(0, 1)

    city = assign_city(rng, preferred_region, travel_style, noise_rate)
    current_city = rng.choice([c for c in CITIES_24 if c != city] or CITIES_24)

    return {
        "age": age,
        "gender": gender,
        "nationality": nationality,
        "current_city": current_city,
        "travel_style": travel_style,
        "budget_level": budget_level,
        "preferred_region": preferred_region,
        "preferred_cuisine": preferred_cuisine,
        "travel_with": travel_with,
        "transport_preference": transport_preference,
        "accommodation_type": accommodation_type,
        "budget_avg": round(budget_avg, 1),
        "is_group": is_group,
        "travel_intensity": travel_intensity,
        "city": city,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--rows", type=int, default=4800, help="Number of synthetic rows")
    ap.add_argument("--noise", type=float, default=0.015, help="Fraction of random city labels")
    args = ap.parse_args()

    rng_py = random.Random(42)
    np.random.seed(42)

    rows = [random_row(rng_py, args.noise) for _ in range(args.rows)]
    df = pd.DataFrame(rows)
    df = ensure_city_coverage(df, rng_py, min_per_city=72)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT_PATH, index=False)

    vc = df["city"].value_counts()
    print(f"Wrote {OUT_PATH} ({len(df)} rows)")
    print("City distribution (top 10):\n", vc.head(10))
    print(f"\nUnique cities in data: {sorted(df['city'].unique())}")


if __name__ == "__main__":
    main()
