import joblib
import pandas as pd
import numpy as np
import time
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

X_train, X_test, y_train, y_test = joblib.load('models/splits.pkl')

print("Entraînement Random Forest...")
t0 = time.time()
rf = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)
print(f"Termine en {time.time()-t0:.1f}s")

y_pred = rf.predict(X_test)
y_proba = rf.predict_proba(X_test)

acc = accuracy_score(y_test, y_pred)
prec = precision_score(y_test, y_pred, average='weighted', zero_division=0)
rec = recall_score(y_test, y_pred, average='weighted', zero_division=0)
f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

top3 = np.argsort(y_proba, axis=1)[:, -3:]
classes = rf.classes_
hit3 = np.mean([y_test.values[i] in classes[top3[i]] for i in range(len(y_test))])

print("\n=== RESULTATS RANDOM FOREST ===")
print(f"Accuracy  : {acc:.4f}")
print(f"Precision : {prec:.4f}")
print(f"Recall    : {rec:.4f}")
print(f"F1-Score  : {f1:.4f}")
print(f"HitRate@3 : {hit3:.4f}")

feature_cols = joblib.load('models/feature_cols.pkl')
importances = pd.Series(rf.feature_importances_, index=feature_cols)
print("\n=== TOP 5 FEATURES ===")
print(importances.sort_values(ascending=False).head(5))

joblib.dump(rf, 'models/rf_model.pkl')
print("\nModele sauvegarde : models/rf_model.pkl")