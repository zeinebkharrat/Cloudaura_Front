import joblib
import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.preprocessing import LabelEncoder, MultiLabelBinarizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
import warnings
warnings.filterwarnings('ignore')

df = pd.read_csv('data/yallatn_recommendations_dataset.csv')
feature_cols = joblib.load('models/feature_cols.pkl')
le_feat = joblib.load('models/label_encoders_features.pkl')
mlb_style = joblib.load('models/mlb_style.pkl')

cat_cols = ['accommodation_type','preferred_cuisine',
            'preferred_region','transport_preference','travel_with']
for col in cat_cols:
    df[col+'_enc'] = le_feat[col].transform(df[col])

style_matrix = mlb_style.transform(df['travel_style'].str.split('|'))
style_df = pd.DataFrame(style_matrix,
           columns=['style_'+c for c in mlb_style.classes_])
df = pd.concat([df.reset_index(drop=True), style_df], axis=1)

X = df[feature_cols]

print("=== MODELE 2 : Evenement recommande ===")
le_event = LabelEncoder()
y_event = le_event.fit_transform(df['recommended_event'])
X_tr, X_te, y_tr, y_te = train_test_split(
    X, y_event, test_size=0.2, random_state=42, stratify=y_event)

xgb_event = XGBClassifier(n_estimators=300, max_depth=6,
                           learning_rate=0.1, eval_metric='mlogloss',
                           random_state=42, n_jobs=-1, verbosity=0)
xgb_event.fit(X_tr, y_tr)
y_pred = xgb_event.predict(X_te)
f1 = f1_score(y_te, y_pred, average='weighted', zero_division=0)
proba = xgb_event.predict_proba(X_te)
top3 = np.argsort(proba, axis=1)[:, -3:]
hit3 = np.mean([y_te[i] in top3[i] for i in range(len(y_te))])
print(f"F1-Score  : {f1:.4f}")
print(f"HitRate@3 : {hit3:.4f}")

print("\n=== MODELE 3 : Activites recommandees ===")
mlb_act = MultiLabelBinarizer()
activities = df['recommended_activities'].str.split('|')
y_act = mlb_act.fit_transform(activities)
X_tr2, X_te2, y_tr2, y_te2 = train_test_split(
    X, y_act, test_size=0.2, random_state=42)

from sklearn.multiclass import OneVsRestClassifier
from sklearn.ensemble import RandomForestClassifier
clf_act = OneVsRestClassifier(
    RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1))
clf_act.fit(X_tr2, y_tr2)
y_pred2 = clf_act.predict(X_te2)
f1_act = f1_score(y_te2, y_pred2, average='weighted', zero_division=0)
print(f"F1-Score activites : {f1_act:.4f}")

joblib.dump(xgb_event, 'models/xgb_event.pkl')
joblib.dump(le_event, 'models/label_encoder_event.pkl')
joblib.dump(clf_act, 'models/model_activities.pkl')
joblib.dump(mlb_act, 'models/mlb_activities.pkl')
print("\nModeles sauvegardes.")

print("\n=== TEST LIVE ===")
test_vec = X.iloc[0:1]
event_pred = le_event.inverse_transform(xgb_event.predict(test_vec))
act_pred = mlb_act.inverse_transform(clf_act.predict(test_vec))
print(f"Evenement predit  : {event_pred[0]}")
print(f"Activites predites: {list(act_pred[0])}")