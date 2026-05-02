import joblib
import numpy as np
from xgboost import XGBClassifier
from sklearn.model_selection import GridSearchCV
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

X_train, X_test, y_train, y_test = joblib.load('models/splits.pkl')

le_city = LabelEncoder()
y_train_enc = le_city.fit_transform(y_train)
y_test_enc = le_city.transform(y_test)

print("GridSearch en cours... (5-10 min)")
params = {
    'max_depth': [4, 6, 8],
    'learning_rate': [0.05, 0.1],
    'n_estimators': [200, 400]
}

xgb = XGBClassifier(eval_metric='mlogloss', random_state=42,
                    n_jobs=-1, verbosity=0)
grid = GridSearchCV(xgb, params, cv=3, scoring='accuracy',
                    verbose=1, n_jobs=-1)
grid.fit(X_train, y_train_enc)

print(f"\nMeilleurs params : {grid.best_params_}")

best = grid.best_estimator_
y_pred = le_city.inverse_transform(best.predict(X_test))
y_proba = best.predict_proba(X_test)

acc = accuracy_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
top3 = np.argsort(y_proba, axis=1)[:, -3:]
hit3 = np.mean([y_test_enc[i] in top3[i] for i in range(len(y_test))])

print(f"\n=== XGBoost TUNED ===")
print(f"Accuracy  : {acc:.4f}  (avant: 0.2332)")
print(f"F1-Score  : {f1:.4f}  (avant: 0.2299)")
print(f"HitRate@3 : {hit3:.4f}  (avant: 0.6405)")

joblib.dump(best, 'models/xgb_tuned.pkl')
joblib.dump(le_city, 'models/label_encoder_city.pkl')
print("\nModele tuned sauvegarde : models/xgb_tuned.pkl")