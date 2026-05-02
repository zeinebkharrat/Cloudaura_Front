# api/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np

app = FastAPI(title="Yallat'N ML API")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:4200"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Chargement des modèles ────────────────────────────────────────────────────
xgb_city           = joblib.load("models/xgb_tuned.pkl")
xgb_event          = joblib.load("models/xgb_event.pkl")
model_activity     = joblib.load("models/model_activities.pkl")
label_enc_features = joblib.load("models/label_encoders_features.pkl")
label_enc_event    = joblib.load("models/label_encoder_event.pkl")
mlb_activities     = joblib.load("models/mlb_activities.pkl")
feature_cols       = joblib.load("models/feature_cols.pkl")
city_names_series  = joblib.load("models/city_names.pkl")
city_map           = city_names_series.to_dict()  # {1: 'Tunis', 2: 'Ariana', ...}

# ── Schéma d'entrée ───────────────────────────────────────────────────────────
class UserPreference(BaseModel):
    accommodation_type: str
    budget_min: float
    budget_max: float
    preferred_cuisine: str
    preferred_region: str
    transport_preference: str
    travel_style: str
    travel_with: str

# ── Preprocessing ─────────────────────────────────────────────────────────────
def preprocess(pref: UserPreference) -> pd.DataFrame:
    data = {
        "accommodation_type":   [pref.accommodation_type],
        "budget_min":           [pref.budget_min],
        "budget_max":           [pref.budget_max],
        "preferred_cuisine":    [pref.preferred_cuisine],
        "preferred_region":     [pref.preferred_region],
        "transport_preference": [pref.transport_preference],
        "travel_style":         [pref.travel_style],
        "travel_with":          [pref.travel_with],
    }
    df = pd.DataFrame(data)

    # Applique les LabelEncoders sauvegardés
    for col, le in label_enc_features.items():
        if col in df.columns:
            df[col] = le.transform(df[col])

    # Aligne les colonnes exactes utilisées à l'entraînement
    df = df.reindex(columns=feature_cols, fill_value=0)
    return df

# ── Endpoint principal ────────────────────────────────────────────────────────
@app.post("/recommend")
def recommend(pref: UserPreference):
    df = preprocess(pref)

    # 1. Top-3 villes
    proba    = xgb_city.predict_proba(df)[0]
    top3_idx = np.argsort(proba)[::-1][:3]

    top3_cities = []
    for i, idx in enumerate(top3_idx):
        city_id   = int(xgb_city.classes_[idx]) + 1
        city_name = city_map.get(city_id, f"ID_{city_id}")
        top3_cities.append({
            "rank":       int(i + 1),
            "city":       str(city_name),
            "confidence": round(float(proba[idx]) * 100, 1)
        })

    # 2. Événement
    event_pred = xgb_event.predict(df)[0]
    event_name = label_enc_event.inverse_transform([event_pred])[0]

    # 3. Activités — top 4 par score de probabilité
    activities_list = []
    try:
        scores = []
        for est in model_activity.estimators_:
            proba_j = est.predict_proba(df)[0]
            score   = proba_j[1] if len(proba_j) > 1 else proba_j[0]
            scores.append(score)

        scores          = np.array(scores)
        top4_idx        = np.argsort(scores)[::-1][:4]
        activities_list = [mlb_activities.classes_[j] for j in top4_idx]

    except Exception:
        pred            = model_activity.predict(df)
        activities_list = list(mlb_activities.inverse_transform(pred)[0])

    return {
        "top_cities": top3_cities,
        "event":      event_name,
        "activities": activities_list,
    }

# ── Endpoint cold-start (Content-Based) ───────────────────────────────────────
@app.post("/recommend/coldstart")
def recommend_coldstart(pref: UserPreference):
    return {"message": "Cold-start endpoint — à connecter à ton content-based filter"}