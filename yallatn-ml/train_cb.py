import joblib
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

df = pd.read_csv('data/yallatn_recommendations_dataset.csv')
feature_cols = joblib.load('models/feature_cols.pkl')
le = joblib.load('models/label_encoders_features.pkl')
mlb = joblib.load('models/mlb_style.pkl')
X_train, X_test, y_train, y_test = joblib.load('models/splits.pkl')

cat_cols = ['accommodation_type','preferred_cuisine',
            'preferred_region','transport_preference','travel_with']
for col in cat_cols:
    df[col+'_enc'] = le[col].transform(df[col])

style_matrix = mlb.transform(df['travel_style'].str.split('|'))
style_df = pd.DataFrame(style_matrix, columns=['style_'+c for c in mlb.classes_])
df = pd.concat([df.reset_index(drop=True), style_df], axis=1)

city_profiles = df.groupby('recommended_city_id')[feature_cols].mean()
city_names = df.drop_duplicates('recommended_city_id').set_index(
    'recommended_city_id')['recommended_city_name']

def recommend_cb(user_vec, top_k=3):
    sims = cosine_similarity([user_vec], city_profiles)[0]
    top_idx = np.argsort(sims)[::-1][:top_k]
    top_ids = city_profiles.index[top_idx]
    return list(top_ids)

print("Evaluation Content-Based sur 500 users...")
sample = X_test.head(500)
y_sample = y_test.head(500)

hits = 0
for i in range(len(sample)):
    recs = recommend_cb(sample.iloc[i].values, top_k=3)
    if y_sample.values[i] in recs:
        hits += 1

hit_rate_cb = hits / len(sample)

print("\n=== RESULTATS CONTENT-BASED ===")
print(f"HitRate@3 : {hit_rate_cb:.4f}")

print("\n=== COMPARAISON FINALE ===")
print(f"{'Metrique':<15} {'RF':>10} {'XGBoost':>10} {'Content-CB':>12}")
print("-" * 50)
print(f"{'HitRate@3':<15} {'0.6247':>10} {'0.6405':>10} {hit_rate_cb:>12.4f}")
print(f"{'Usage':<15} {'baseline':>10} {'prod':>10} {'cold-start':>12}")

joblib.dump(city_profiles, 'models/city_profiles.pkl')
joblib.dump(city_names, 'models/city_names.pkl')
print("\nProfils villes sauvegardes.")

print("\n=== TEST RECOMMANDATION LIVE ===")
test_user = X_test.iloc[0].values
recs = recommend_cb(test_user, top_k=3)
print("User test → villes recommandees:")
for city_id in recs:
    print(f"  - {city_names[city_id]} (id={city_id})")