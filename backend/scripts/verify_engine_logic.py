import sys
import os
import joblib
import pandas as pd

# Pathing fix
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.engine import engine

def audit_engine():
    print("-" * 50)
    print("OPTIASET ENGINE STATISTICAL AUDIT")
    print("-" * 50)

    if not engine.model:
        print("[FAIL] Model artifacts not loaded.")
        print(f"Target Path: {engine.model_path}")
        print("Check if 'model.pkl' and 'scaler.pkl' exist in the backend/data directory.")
        return

    # 1. Inspect the mapping the engine decided on
    print(f"Automated Mapping: {engine.mapping}")

    # 2. Extract and Unscale Centroids for Human Reading
    # Feature indices: 0:age, 1:temp_r, 2:usage_r, 3:maint, 4:repairs
    centers = engine.model.cluster_centers_

    # We unscale them to see the real 'Ratio' values
    unscaled_centers = engine.scaler.inverse_transform(centers)

    audit_data = []
    for i, row in enumerate(unscaled_centers):
        audit_data.append({
            "ClusterID": i,
            "Label": engine.mapping.get(i),
            "AvgAge": round(row[0], 1),
            "TempRatio": round(row[1], 2),
            "UsageRatio": round(row[2], 2),
            "Maint": round(row[3], 1),
            "Repairs": round(row[4], 1)
        })

    df = pd.DataFrame(audit_data).sort_values(by="TempRatio")
    print("\n[CENTROID PROFILE]")
    print(df.to_string(index=False))

    # 3. Validation Logic
    healthy = df[df['Label'] == 'Healthy'].iloc[0]
    critical = df[df['Label'] == 'Critical'].iloc[0]

    print("\n[INTEGRITY CHECK]")
    if healthy['TempRatio'] < critical['TempRatio'] and healthy['Repairs'] <= critical['Repairs']:
        print("Status: [PASS] Logic is statistically sound.")
        print(f"Reason: Healthy cluster is cooler ({healthy['TempRatio']}x) than Critical ({critical['TempRatio']}x).")
    else:
        print("Status: [FAIL] Cluster definitions are mathematically inconsistent.")

if __name__ == "__main__":
    audit_engine()