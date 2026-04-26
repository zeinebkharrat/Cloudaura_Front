# Travel match — test examples

The browser shows **calibrated** match % (top city is designed to read **above ~90%** when it clearly leads the shortlist).  
Ordering still comes from the same centroid + softmax pipeline as training.

## Quick test in the app

1. Sign in, complete the preference wizard **or** set `localStorage` key `yalla_travel_prefs_v2_u<USER_ID>` to one of the JSON payloads below (DevTools → Application → Local Storage).

2. Open home: the **first** city in the strip should show **≥ ~92%** in normal cases.

## Payloads (from real CSV rows)

Use `travel_styles` as a single-element array when you only pick one style (same as training rows).

### Example A — row aligned with coastal party profile (dataset points to Sousse)

```json
{
  "age": 53,
  "gender": "male",
  "nationality": "african",
  "current_city": "Tozeur",
  "travel_style": "party",
  "travel_styles": ["party"],
  "budget_level": "medium",
  "preferred_region": "coastal",
  "preferred_cuisine": "african",
  "travel_with": "solo",
  "transport_preference": "plane",
  "accommodation_type": "hostel",
  "budget_avg": 150,
  "is_group": 0,
  "travel_intensity": "high"
}
```

### Example B — cultural / desert (dataset points to Douz)

```json
{
  "age": 33,
  "gender": "female",
  "nationality": "other",
  "current_city": "Sfax",
  "travel_style": "cultural",
  "travel_styles": ["cultural"],
  "budget_level": "medium",
  "preferred_region": "desert",
  "preferred_cuisine": "european",
  "travel_with": "solo",
  "transport_preference": "plane",
  "accommodation_type": "resort",
  "budget_avg": 102,
  "is_group": 0,
  "travel_intensity": "medium"
}
```

### Example C — beaches + relaxation (multi-style; beaches added in model)

```json
{
  "age": 40,
  "gender": "male",
  "nationality": "other",
  "current_city": "Sousse",
  "travel_style": "relaxation",
  "travel_styles": ["beaches", "relaxation", "cultural"],
  "budget_level": "medium",
  "preferred_region": "north",
  "preferred_cuisine": "tunisian",
  "travel_with": "friends",
  "transport_preference": "plane",
  "accommodation_type": "airbnb",
  "budget_avg": 143,
  "is_group": 1,
  "travel_intensity": "low"
}
```

## CLI sanity check

From repo root:

```bash
python scripts/travel_match_selftest.py
```

Prints centroid top-1 vs dataset label for sample rows and dumps example JSON.
