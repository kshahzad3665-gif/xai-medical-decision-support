"""
Train Diabetes and Heart Disease models, save as .pkl files.
Uses scikit-learn RandomForestClassifier (no xgboost needed).
"""
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import os

np.random.seed(42)

# ── Diabetes Dataset (Pima Indians – synthetic but realistic) ─────────────────
def make_diabetes_data(n=768):
    neg = int(n * 0.651)
    pos = n - neg
    def sample(mean, std, size): return np.clip(np.random.normal(mean, std, size), 0, None)

    neg_X = np.column_stack([
        sample(3.3, 3.0, neg),    # pregnancies
        sample(109, 26, neg),      # glucose
        sample(68, 18, neg),       # blood_pressure
        sample(19, 15, neg),       # skin_thickness
        sample(68, 98, neg),       # insulin
        sample(30.1, 7.5, neg),    # bmi
        sample(0.43, 0.30, neg),   # diabetes_pedigree
        sample(31, 11, neg),       # age
    ])
    pos_X = np.column_stack([
        sample(4.9, 3.7, pos),
        sample(141, 31, pos),
        sample(70, 21, pos),
        sample(22, 17, pos),
        sample(100, 138, pos),
        sample(35.1, 7.3, pos),
        sample(0.55, 0.37, pos),
        sample(37, 11, pos),
    ])
    X = np.vstack([neg_X, pos_X])
    y = np.array([0]*neg + [1]*pos)
    idx = np.random.permutation(n)
    return X[idx], y[idx]

# ── Heart Disease Dataset (Cleveland-style) ───────────────────────────────────
def make_heart_data(n=303):
    neg = int(n * 0.46)
    pos = n - neg
    def s(m, sd, size, lo=None, hi=None):
        v = np.random.normal(m, sd, size)
        if lo is not None: v = np.clip(v, lo, hi)
        return v

    neg_X = np.column_stack([
        s(52, 9, neg, 29, 77),         # age
        np.random.binomial(1, 0.44, neg),  # sex
        np.random.choice([0,1,2,3], neg, p=[0.08,0.15,0.28,0.49]),  # cp
        s(129, 17, neg, 90, 200),      # trestbps
        s(242, 52, neg, 140, 400),     # chol
        np.random.binomial(1, 0.14, neg),  # fbs
        np.random.choice([0,1,2], neg, p=[0.50,0.37,0.13]),  # restecg
        s(158, 19, neg, 90, 202),      # thalach
        np.random.binomial(1, 0.14, neg),  # exang
        s(0.59, 0.92, neg, 0, 6),      # oldpeak
        np.random.choice([0,1,2], neg, p=[0.21,0.62,0.17]),  # slope
        s(0.63, 1.06, neg, 0, 3),      # ca
        np.random.choice([0,1,2,3], neg, p=[0.18,0.54,0.07,0.21]),  # thal
    ])
    pos_X = np.column_stack([
        s(56, 8, pos, 29, 77),
        np.random.binomial(1, 0.82, pos),
        np.random.choice([0,1,2,3], pos, p=[0.30,0.22,0.24,0.24]),
        s(134, 20, pos, 90, 200),
        s(251, 49, pos, 140, 400),
        np.random.binomial(1, 0.22, pos),
        np.random.choice([0,1,2], pos, p=[0.38,0.54,0.08]),
        s(139, 24, pos, 90, 202),
        np.random.binomial(1, 0.55, pos),
        s(1.59, 1.31, pos, 0, 6),
        np.random.choice([0,1,2], pos, p=[0.08,0.42,0.50]),
        s(1.72, 1.22, pos, 0, 3),
        np.random.choice([0,1,2,3], pos, p=[0.06,0.18,0.05,0.71]),
    ])
    X = np.vstack([neg_X, pos_X])
    y = np.array([0]*neg + [1]*pos)
    idx = np.random.permutation(n)
    return X[idx], y[idx]

os.makedirs("models", exist_ok=True)

# ── Train Diabetes ─────────────────────────────────────────────────────────────
Xd, yd = make_diabetes_data(900)
Xd_tr, Xd_te, yd_tr, yd_te = train_test_split(Xd, yd, test_size=0.2, random_state=42, stratify=yd)
scaler_d = StandardScaler()
Xd_tr_s = scaler_d.fit_transform(Xd_tr)
Xd_te_s = scaler_d.transform(Xd_te)
model_d = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, class_weight='balanced')
model_d.fit(Xd_tr_s, yd_tr)
acc_d = accuracy_score(yd_te, model_d.predict(Xd_te_s))
print(f"Diabetes  model accuracy: {acc_d:.3f}")

with open("models/diabetes_model.pkl", "wb") as f: pickle.dump(model_d, f)
with open("models/diabetes_scaler.pkl", "wb") as f: pickle.dump(scaler_d, f)

# ── Train Heart Disease ────────────────────────────────────────────────────────
Xh, yh = make_heart_data(600)
Xh_tr, Xh_te, yh_tr, yh_te = train_test_split(Xh, yh, test_size=0.2, random_state=42, stratify=yh)
scaler_h = StandardScaler()
Xh_tr_s = scaler_h.fit_transform(Xh_tr)
Xh_te_s = scaler_h.transform(Xh_te)
model_h = RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, class_weight='balanced')
model_h.fit(Xh_tr_s, yh_tr)
acc_h = accuracy_score(yh_te, model_h.predict(Xh_te_s))
print(f"Heart     model accuracy: {acc_h:.3f}")

with open("models/heart_model.pkl", "wb") as f: pickle.dump(model_h, f)
with open("models/heart_scaler.pkl", "wb") as f: pickle.dump(scaler_h, f)

# Save training data samples for PDP computation
with open("models/diabetes_train.pkl", "wb") as f: pickle.dump(Xd_tr_s[:200], f)
with open("models/heart_train.pkl", "wb") as f: pickle.dump(Xh_tr_s[:200], f)

print("All models saved.")
