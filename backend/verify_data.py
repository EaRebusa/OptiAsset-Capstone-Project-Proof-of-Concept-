import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from pathlib import Path

# -------------------------------------------------------------------
# CONFIGURATION
# -------------------------------------------------------------------
INPUT_FILE = Path("data/optiasset_inventory_1200.csv")

def verify_data_quality():
    """Performs deep diagnostic analysis on generated data quality."""
    if not INPUT_FILE.exists():
        print(f"[ERROR] CSV not found at {INPUT_FILE}")
        return

    # 1. Load Data
    df = pd.read_csv(INPUT_FILE)

    # 2. Feature Selection
    features = ['initial_age', 'current_temp', 'current_usage', 'maint_score', 'repairs']
    X = df[features]

    # 3. Preprocessing
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 4. Diagnostic: SSE (Elbow Method logic)
    # Testing k=3 specifically as it's our target (Healthy/Warning/Critical)
    kmeans = KMeans(n_clusters=3, n_init=10, random_state=42)
    labels = kmeans.fit_predict(X_scaled)
    sse = kmeans.inertia_

    # 5. Metrics Calculation
    score = silhouette_score(X_scaled, labels)
    df['cluster'] = labels

    print("-" * 40)
    print("OPTIASET DEEP DATA DIAGNOSTIC")
    print("-" * 40)
    print(f"Total Samples: {len(df)}")
    print(f"Silhouette Score: {score:.4f}")
    print(f"Inertia (SSE): {sse:.2f}")

    # Interpretation Logic
    if score > 0.5:
        print("Status: [PASS] Data is ready for ML implementation.")
    else:
        print("Status: [FAIL] High overlap detected. Physics adjustment needed.")

    # 6. Feature Correlation (Why is the score low?)
    # High correlation between features helps clustering.
    # If correlation is near 0, the features are 'fighting' each other.
    print("\n[FEATURE CORRELATION TO CLUSTER]")
    correlations = df[features + ['cluster']].corr()['cluster'].sort_values(ascending=False)
    print(correlations)

    # 7. Cluster Profiling
    print("\n[CLUSTER AVERAGES]")
    profile = df.groupby('cluster')[features].mean()
    print(profile)

    # 8. Density Check
    print("\n[CLUSTER DISTRIBUTION]")
    print(df['cluster'].value_counts(normalize=True).map(lambda n: f"{n:.1%}"))
    print("-" * 40)

if __name__ == "__main__":
    verify_data_quality()