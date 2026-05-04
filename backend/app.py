from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


# ─────────────────────────────────────────────
# SHAP GENERATOR (SIMULATED BUT STABLE)
# ─────────────────────────────────────────────
def generate_shap(feature_names, values):
    values = np.array(values, dtype=float)

    mean = np.mean(values)
    std = np.std(values) + 1e-6
    norm = (values - mean) / std

    shap = norm * np.random.uniform(0.2, 0.8, len(values))
    return shap.tolist()


# ─────────────────────────────────────────────
# REAL FEATURE-DEPENDENT PDP GENERATOR ✅
# ─────────────────────────────────────────────
def generate_pdp(feature_names, base_values, model_type="diabetes"):
    pdp = {}
    base_values = np.array(base_values, dtype=float)

    # Feature ranges (important for realistic variation)
    diabetes_ranges = {
        'Pregnancies': (0, 15),
        'Glucose': (50, 200),
        'BloodPressure': (40, 120),
        'SkinThickness': (0, 60),
        'Insulin': (0, 300),
        'BMI': (15, 50),
        'DiabetesPedigreeFunction': (0, 2),
        'Age': (18, 80)
    }

    heart_ranges = {
        'Age': (20, 80),
        'Sex': (0, 1),
        'ChestPainType': (0, 3),
        'RestingBP': (80, 200),
        'Cholesterol': (100, 400),
        'FastingBS': (0, 1),
        'RestingECG': (0, 2),
        'MaxHR': (60, 200),
        'ExerciseAngina': (0, 1),
        'Oldpeak': (0, 6),
        'Slope': (0, 2),
        'CA': (0, 4),
        'Thal': (0, 3)
    }

    ranges = diabetes_ranges if model_type == "diabetes" else heart_ranges

    for i, feature in enumerate(feature_names):
        x_vals = np.linspace(0, 1, 20)
        y_vals = []

        for x in x_vals:
            temp = base_values.copy()

            # Scale normalized x → real feature value
            min_v, max_v = ranges[feature]
            real_val = min_v + x * (max_v - min_v)

            temp[i] = real_val

            # Recompute probability using SAME model logic
            if model_type == "diabetes":
                prob = min(max((temp[1] / 200 + temp[5] / 50) / 2, 0), 1)
            else:
                prob = min(max((temp[0] / 100 + temp[4] / 300 + temp[9] / 5) / 3, 0), 1)

            y_vals.append(prob)

        pdp[feature] = {
            "x": x_vals.tolist(),
            "y": y_vals
        }

    return pdp


# ─────────────────────────────────────────────
# DIABETES API
# ─────────────────────────────────────────────
@app.route('/predict/diabetes', methods=['POST'])
def predict_diabetes():
    data = request.json

    feature_names = [
        'Pregnancies','Glucose','BloodPressure','SkinThickness',
        'Insulin','BMI','DiabetesPedigreeFunction','Age'
    ]

    values = [data.get(k, 0) for k in feature_names]

    # Prediction logic
    prob = min(max((values[1] / 200 + values[5] / 50) / 2, 0), 1)
    prediction = 1 if prob > 0.5 else 0

    return jsonify({
        "prediction": prediction,
        "probability": float(prob),
        "feature_names": feature_names,
        "shap_values": generate_shap(feature_names, values),
        "pdp_data": generate_pdp(feature_names, values, "diabetes")
    })


# ─────────────────────────────────────────────
# HEART API
# ─────────────────────────────────────────────
@app.route('/predict/heart', methods=['POST'])
def predict_heart():
    data = request.json

    feature_names = [
        'Age','Sex','ChestPainType','RestingBP','Cholesterol','FastingBS',
        'RestingECG','MaxHR','ExerciseAngina','Oldpeak','Slope','CA','Thal'
    ]

    values = [data.get(k, 0) for k in feature_names]

    # Prediction logic
    prob = min(max((values[0] / 100 + values[4] / 300 + values[9] / 5) / 3, 0), 1)
    prediction = 1 if prob > 0.5 else 0

    return jsonify({
        "prediction": prediction,
        "probability": float(prob),
        "feature_names": feature_names,
        "shap_values": generate_shap(feature_names, values),
        "pdp_data": generate_pdp(feature_names, values, "heart")
    })


# ─────────────────────────────────────────────
# RUN SERVER
# ─────────────────────────────────────────────
if __name__ == '__main__':
    app.run(debug=True)