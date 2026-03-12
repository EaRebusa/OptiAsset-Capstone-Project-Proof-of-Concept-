import sys
import os
import pandas as pd
import joblib
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from pathlib import Path

# Pathing fix
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.models.schemas import Asset, Spec

def train():
    """
    Trains the K-Means model using ratios derived from the DB.
    Serializes model/scaler for the Scoring Engine.
    """
    db = SessionLocal()
    try:
        print("[1/4] Fetching assets and specs...")
        # Join assets with their specs to calculate ratios
        query = db.query(Asset, Spec).join(Spec, Asset.model_name == Spec.model_name).all()

        data = []
        for asset, spec in query:
            # We use initial_age for training baseline
            temp_ratio = asset.current_temp / spec.temp_norm
            usage_ratio = asset.current_usage / spec.usage_norm

            data.append([
                asset.initial_age,
                temp_ratio,
                usage_ratio,
                asset.maint_score,
                asset.repairs
            ])

        if len(data) < 100:
            print("[ERROR] Not enough data to train. Need at least 100 rows.")
            return

        # 2. Preprocessing
        print("[2/4] Scaling features...")
        X = pd.DataFrame(data, columns=['age', 'temp_r', 'usage_r', 'maint', 'repairs'])
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # 3. Training K-Means
        print("[3/4] Training K-Means (k=3)...")
        kmeans = KMeans(n_clusters=3, n_init=20, random_state=42)
        kmeans.fit(X_scaled)

        # 4. Serialization
        print("[4/4] Saving 'brains' to data/ directory...")
        # Robust pathing to ensure artifacts are saved in backend/data/
        base_dir = Path(__file__).resolve().parent.parent # .../backend
        data_dir = base_dir / "data"
        os.makedirs(data_dir, exist_ok=True)
        
        joblib.dump(kmeans, data_dir / "model.pkl")
        joblib.dump(scaler, data_dir / "scaler.pkl")

        print(f"[SUCCESS] model.pkl and scaler.pkl are ready in {data_dir}")

    except Exception as e:
        print(f"[FATAL ERROR] Training failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    train()