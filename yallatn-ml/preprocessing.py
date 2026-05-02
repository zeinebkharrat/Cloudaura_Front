import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, MultiLabelBinarizer
from sklearn.model_selection import train_test_split
import joblib
import os

os.makedirs('models', exist_ok=True)
os.makedirs('results', exist_ok=True)

df = pd.read_csv('data/yallatn_recommendations_dataset.csv')

cat_cols = ['accommodation_type','preferred_cuisine',
            'preferred_region','transport_preference','travel_with']
le = {}
for col in cat_cols:
    le[col] = LabelEncoder()
    df[col+'_enc'] = le[col].fit_transform(df[col])

mlb = MultiLabelBinarizer()
styles = df['travel_style'].str.split('|')
style_matrix = mlb.fit_transform(styles)
style_df = pd.DataFrame(style_matrix, columns=['style_'+c for c in mlb.classes_])
df = pd.concat([df.reset_index(drop=True), style_df], axis=1)

feature_cols = ['accommodation_type_enc','budget_min','budget_max',
                'preferred_cuisine_enc','preferred_region_enc',
                'transport_preference_enc','travel_with_enc'] + list(style_df.columns)

X = df[feature_cols]
y = df['recommended_city_id']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

joblib.dump(le, 'models/label_encoders_features.pkl')
joblib.dump(mlb, 'models/mlb_style.pkl')
joblib.dump(feature_cols, 'models/feature_cols.pkl')
joblib.dump((X_train, X_test, y_train, y_test), 'models/splits.pkl')

print("Features:", len(feature_cols))
print("X_train:", X_train.shape)
print("X_test:", X_test.shape)
print("Classes (villes):", y.nunique())
print("Preprocessing OK")