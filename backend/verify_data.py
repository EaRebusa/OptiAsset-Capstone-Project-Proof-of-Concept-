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

    # Configure pandas to always display all columns for better analysis
    pd.set_option('display.max_columns', None)

    # 1. Load Data
    df = pd.read_csv(INPUT_FILE)

    # 2. Feature Engineering & Standardization
    # This logic should mirror your `Cold Start.py` script to ensure consistency.
    # We define baseline "normal" parameters to create normalized features.
    NORMAL_TEMP = 40.0
    NORMAL_USAGE = 30.0

    # Create the engineered features that the model was trained on
    df['age_vs_warranty'] = df['initial_age']
    df['temp_vs_norm'] = df['current_temp'] / NORMAL_TEMP
    df['usage_vs_norm'] = df['current_usage'] / NORMAL_USAGE
    # Standardize the column name to match what the model expects ('maint_score' -> 'maintenance_score')
    df['maintenance_score'] = df['maint_score']

    # 3. Feature Selection
    features = ['age_vs_warranty', 'temp_vs_norm', 'usage_vs_norm', 'maintenance_score', 'repairs']
    X = df[features]

    # 4. Preprocessing
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # 5. Diagnostic: SSE (Elbow Method logic)
    # Testing k=3 specifically as it's our target (Healthy/Warning/Critical)
    kmeans = KMeans(n_clusters=3, n_init=10, random_state=42)
    labels = kmeans.fit_predict(X_scaled)
    sse = kmeans.inertia_

    # 6. Metrics Calculation
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

    # 7. Feature Correlation (Why is the score low?)
    # High correlation between features helps clustering.
    # If correlation is near 0, the features are 'fighting' each other.
    print("\n[FEATURE CORRELATION TO CLUSTER]")
    correlations = df[features + ['cluster']].corr()['cluster'].sort_values(ascending=False)
    print(correlations)

    # 8. Cluster Profiling
    print("\n[CLUSTER AVERAGES]")
    profile = df.groupby('cluster')[features].mean()
    print(profile)

    # 9. Density Check
    print("\n[CLUSTER DISTRIBUTION]")
    print(df['cluster'].value_counts(normalize=True).map(lambda n: f"{n:.1%}"))
    print("-" * 40)

if __name__ == "__main__":
    verify_data_quality()