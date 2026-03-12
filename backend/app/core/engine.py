import numpy as np
import joblib
import os
from datetime import datetime
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

class ScoringEngine:
    """
    Singleton engine for health prediction.
    Uses absolute pathing to ensure artifacts are found regardless of CWD.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ScoringEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized: return

        # Robust Pathing: Find 'data' folder relative to this file's location
        # backend/app/core/engine.py -> backend/data/
        self.base_dir = Path(__file__).resolve().parent.parent.parent
        self.data_dir = self.base_dir / "data"

        self.model_path = self.data_dir / "model.pkl"
        self.scaler_path = self.data_dir / "scaler.pkl"

        self.model = None
        self.scaler = None
        self.mapping = {}

        self.load_artifacts()
        self._initialized = True

    def load_artifacts(self):
        """Loads artifacts and triggers statistical calibration."""
        if self.model_path.exists() and self.scaler_path.exists():
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self._calibrate_mapping()
            except Exception as e:
                print(f"[CORE] Artifact Load Error: {e}")
        else:
            # Silence is not helpful for debugging
            print(f"[CORE] Warning: Artifacts not found at {self.model_path}")

    def _calibrate_mapping(self):
        """
        Statistical Calibration: Analyzes centroids to assign labels.
        Ranked by Risk Index (Heat + Usage + Repairs - Maintenance).
        """
        if not self.model: return

        centroids = self.model.cluster_centers_
        risk_scores = []

        for i, center in enumerate(centroids):
            # Features: [age, temp_r, usage_r, maint, repairs]
            risk_index = center[1] + center[2] + center[4] - (center[3] / 10)
            risk_scores.append((i, risk_index))

        sorted_clusters = sorted(risk_scores, key=lambda x: x[1])

        self.mapping = {
            sorted_clusters[0][0]: "Healthy",
            sorted_clusters[1][0]: "Warning",
            sorted_clusters[2][0]: "Critical"
        }

    def calculate_current_age(self, initial_age, created_at):
        """Calculates effective age in months (Auto-aging logic)."""
        now = datetime.now()
        months_passed = (now.year - created_at.year) * 12 + (now.month - created_at.month)
        return initial_age + max(0, months_passed)

    def prepare_features(self, asset, spec):
        """Feature Engineering: Converts telemetry to dimensionless ratios."""
        current_age = self.calculate_current_age(asset.initial_age, asset.created_at)
        temp_ratio = asset.current_temp / spec.temp_norm
        usage_ratio = asset.current_usage / spec.usage_norm

        return np.array([
            current_age,
            temp_ratio,
            usage_ratio,
            asset.maint_score,
            asset.repairs
        ]).reshape(1, -1)

    def predict_health(self, features):
        """Standardizes input and returns calibrated BTM label."""
        if not self.model or not self.scaler or not self.mapping:
            return "Unscored", None

        try:
            scaled_x = self.scaler.transform(features)
            cluster_id = int(self.model.predict(scaled_x)[0])
            label = self.mapping.get(cluster_id, "Unknown")
            return label, cluster_id
        except Exception as e:
            print(f"[CORE] Prediction Error: {e}")
            return "Error", None

    def retrain_model(self, active_assets):
        """
        Refreshes the AI Brain using the current live database.
        Accepts a list of Asset objects (fetched by the router).
        """
        if not active_assets or len(active_assets) < 10:
            return False, "Insufficient data for retraining (Need 10+ assets)"

        training_data = []

        for asset in active_assets:
            if not asset.spec: continue # Skip assets with missing specs

            # Re-calculate features exactly as done in prediction
            # [current_age, temp_ratio, usage_ratio, maint_score, repairs]
            features = self.prepare_features(asset, asset.spec)
            training_data.append(features[0])

        if not training_data:
            return False, "No valid training data could be generated."

        X_train = np.array(training_data)

        try:
            # 1. New Scaler
            new_scaler = StandardScaler()
            X_scaled = new_scaler.fit_transform(X_train)

            # 2. New KMeans
            # We stick to 3 clusters: Healthy, Warning, Critical
            new_model = KMeans(n_clusters=3, random_state=42, n_init=10)
            new_model.fit(X_scaled)

            # 3. Save Artifacts
            joblib.dump(new_model, self.model_path)
            joblib.dump(new_scaler, self.scaler_path)

            # 4. Hot-Reload into Memory
            self.model = new_model
            self.scaler = new_scaler
            self._calibrate_mapping() # Critical: Re-assign which cluster ID means "Critical"

            return True, f"Model successfully retrained on {len(X_train)} assets."

        except Exception as e:
            return False, f"Training failed: {str(e)}"

# Global Instance
engine = ScoringEngine()