import joblib
import pandas as pd
import numpy as np
import time
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, ndcg_score
from sklearn.preprocessing import label_binarize

X_train, X_test, y_train, y_test = joblib.load('models/splits.pkl')

le_city = LabelEncoder()
y_train_enc = le_city.fit_transform(y_train)
y_test_enc = le_city.transform(y_test)

print("Entraînement XGBoost...")
t0 = time.time()
xgb = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.1,
    eval_metric='mlogloss',
    random_state=42,
    n_jobs=-1,
    verbosity=0
)
xgb.fit(X_train, y_train_enc)
print(f"Termine en {time.time()-t0:.1f}s")

y_pred_enc = xgb.predict(X_test)
y_pred = le_city.inverse_transform(y_pred_enc)
y_proba = xgb.predict_proba(X_test)

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

top3 = np.argsort(y_proba, axis=1)[:, -3:]
hit3 = np.mean([y_test_enc[i] in top3[i] for i in range(len(y_test))])

y_true_bin = label_binarize(y_test_enc, classes=range(len(le_city.classes_)))
ndcg = ndcg_score(y_true_bin, y_proba)

print("\n=== RESULTATS XGBOOST ===")
print(f"Accuracy  : {acc:.4f}")
print(f"Precision : {prec:.4f}")
print(f"Recall    : {rec:.4f}")
print(f"F1-Score  : {f1:.4f}")
print(f"HitRate@3 : {hit3:.4f}")
print(f"NDCG      : {ndcg:.4f}")

print("\n=== COMPARAISON RF vs XGB ===")
print(f"{'Metrique':<15} {'Random Forest':>15} {'XGBoost':>15}")
print("-" * 46)
print(f"{'Accuracy':<15} {'0.2288':>15} {acc:.4f}")
print(f"{'F1-Score':<15} {'0.2267':>15} {f1:.4f}")
print(f"{'HitRate@3':<15} {'0.6247':>15} {hit3:.4f}")

joblib.dump(xgb, 'models/xgb_model.pkl')
joblib.dump(le_city, 'models/label_encoder_city.pkl')
print("\nModele sauvegarde : models/xgb_model.pkl")