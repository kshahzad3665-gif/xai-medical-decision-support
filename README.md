# XAI Healthcare Dashboard
### MSc Information Technology — Khizar Shahzad (c7556498)
### Leeds Beckett University — Dissertation Project 2026

---

## Overview

A professional, real-time Explainable AI (XAI) clinical decision support dashboard
integrating two pre-trained machine learning models (Diabetes & Heart Disease)
with SHAP-based feature attribution, Partial Dependence Plots (PDP), and an
interactive D3.js frontend.

**Tech Stack:**
- Backend:  Python 3.11 + Flask REST API
- Frontend: HTML5, CSS3, JavaScript ES6, D3.js v7
- ML:       scikit-learn RandomForestClassifier
- XAI:      Native SHAP permutation + LIME surrogate (no extra install needed)

---

## Project Structure

```
xai_dashboard/
├── backend/
│   ├── app.py               ← Flask API (main server)
│   ├── train_models.py      ← Train & save .pkl models
│   ├── requirements.txt     ← Python dependencies
│   └── models/              ← Auto-created by train_models.py
│       ├── diabetes_model.pkl
│       ├── diabetes_scaler.pkl
│       ├── diabetes_train.pkl
│       ├── heart_model.pkl
│       ├── heart_scaler.pkl
│       └── heart_train.pkl
└── frontend/
    └── index.html           ← Complete dashboard (open in browser)
```

---

## Setup & Run

### Step 1 — Install Python dependencies
```bash
cd backend
pip install flask flask-cors scikit-learn numpy pandas
```

### Step 2 — Train models (run once)
```bash
cd backend
python train_models.py
```
Expected output:
```
Diabetes  model accuracy: 0.767
Heart     model accuracy: 0.883
All models saved.
```

### Step 3 — Start Flask API
```bash
cd backend
python app.py
```
The API starts on http://localhost:5000

### Step 4 — Open Dashboard
Open `frontend/index.html` directly in your browser.
The dashboard connects automatically to the Flask API on port 5000.

---

## API Endpoints

| Method | Endpoint            | Description                    |
|--------|---------------------|--------------------------------|
| GET    | /health             | Check API status               |
| POST   | /predict/diabetes   | Diabetes prediction + XAI      |
| POST   | /predict/heart      | Heart disease prediction + XAI |

### Example Request — Diabetes
```bash
curl -X POST http://localhost:5000/predict/diabetes \
  -H "Content-Type: application/json" \
  -d '{
    "Pregnancies": 3,
    "Glucose": 148,
    "BloodPressure": 72,
    "SkinThickness": 35,
    "Insulin": 0,
    "BMI": 33.6,
    "DiabetesPedigreeFunction": 0.627,
    "Age": 50
  }'
```

### Example Response
```json
{
  "prediction": 1,
  "probability": 0.82,
  "base_value": 0.82,
  "shap_values": [0.031, 0.184, -0.012, 0.028, 0.005, 0.091, 0.042, 0.067],
  "lime_values": [0.019, 0.142, -0.008, 0.021, 0.003, 0.077, 0.033, 0.058],
  "feature_names": ["Pregnancies","Glucose","BloodPressure","SkinThickness","Insulin","BMI","DiabetesPedigreeFunction","Age"],
  "feature_values": [3, 148, 72, 35, 0, 33.6, 0.627, 50],
  "pdp_data": { "Glucose": { "x": [...], "y": [...] }, ... },
  "feature_importance": [0.065, 0.278, 0.091, 0.052, 0.071, 0.183, 0.131, 0.129]
}
```

---

## Dashboard Features

| Panel              | Feature                                                    |
|--------------------|------------------------------------------------------------|
| Patient Input      | 8 fields (diabetes) / 13 fields (heart), with validation   |
| Prediction Panel   | Animated D3.js gauge chart, risk level, probability        |
| SHAP Panel         | Horizontal bar chart, red/blue colour-coded, animated      |
| PDP Panel          | Interactive D3.js line chart, feature dropdown, hover      |
| History Strip      | Session history (last 8 predictions), click to restore     |
| Export Report      | Download plain-text summary of all session predictions     |

---

## Sample Patient Values

### Diabetes (High Risk)
| Feature                   | Value |
|---------------------------|-------|
| Pregnancies               | 6     |
| Glucose                   | 148   |
| Blood Pressure            | 72    |
| Skin Thickness            | 35    |
| Insulin                   | 0     |
| BMI                       | 33.6  |
| Diabetes Pedigree Function| 0.627 |
| Age                       | 50    |

### Heart Disease (High Risk)
| Feature       | Value |
|---------------|-------|
| Age           | 63    |
| Sex           | 1     |
| Chest Pain    | 3     |
| Resting BP    | 145   |
| Cholesterol   | 233   |
| Fasting BS    | 1     |
| Resting ECG   | 2     |
| Max HR        | 150   |
| Exercise Angina| 0    |
| Oldpeak       | 2.3   |
| Slope         | 0     |
| CA            | 0     |
| Thal          | 1     |

---

## Deployment (Render / Heroku)

### Heroku
```bash
heroku create xai-healthcare-dashboard
git push heroku main
```
Add a `Procfile`:
```
web: gunicorn app:app
```

### Render
1. Push to GitHub
2. Create a new Web Service on render.com
3. Build command: `pip install -r requirements.txt && python train_models.py`
4. Start command: `gunicorn app:app`
5. Set `FLASK_ENV=production` environment variable

---

## Methodology Alignment

| Requirement                    | Implementation                          |
|--------------------------------|-----------------------------------------|
| REST API endpoints             | /predict/diabetes, /predict/heart       |
| Real-time prediction           | Flask + fetch API                       |
| SHAP explainability            | Permutation-based SHAP approximation    |
| LIME explainability            | Weighted linear surrogate               |
| PDP visualisation              | All features, D3.js line chart          |
| Interactive D3.js charts       | Gauge, SHAP bar chart, PDP line chart   |
| Input validation               | Client-side + server-side               |
| Modular architecture           | Frontend/backend fully decoupled        |
| Patient history tracking       | Session-level history with restore      |
| Export report                  | Plain-text download                     |
| Responsive UI                  | CSS Grid, mobile-friendly               |

---

## Author
**Khizar Shahzad** | Student ID: c7556498  
MSc Information Technology | Leeds Beckett University | 2026
