import sys
from pathlib import Path
import joblib
import pandas as pd

# Resolve the backend root directory (same approach as Cold Start.py)
backend_root = Path(__file__).resolve().parent.parent

def analyze_centroids():
    print("📊 Loading ML artifacts to analyze cluster centroids...")
    
    data_dir = backend_root / "data"
    model_path = data_dir / "model.pkl"
    scaler_path = data_dir / "scaler.pkl"

    if not model_path.exists() or not scaler_path.exists():
        print("❌ [ERROR] Missing model.pkl or scaler.pkl in the data directory.")
        print("   Make sure you have trained your model first!")
        return

    # 1. Load the saved model and scaler
    kmeans = joblib.load(model_path)
    scaler = joblib.load(scaler_path)

    # 2. Define the features EXACTLY as they were passed during training
    features = ['age_vs_warranty', 'temp_vs_norm', 'usage_vs_norm', 'maintenance_score', 'repairs']

    # 3. Extract and un-scale the centroids
    centroids = kmeans.cluster_centers_
    real_centroids = scaler.inverse_transform(centroids)

    # 4. Format and print the results
    df_centroids = pd.DataFrame(real_centroids, columns=features)
    df_centroids.index.name = 'Cluster'
    print("\n✨ Cluster Centroids (Real-World Values):")
    print(df_centroids)

if __name__ == "__main__":
    analyze_centroids()