import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
from pathlib import Path

# Setup paths
DATA_DIR = Path("../data/samples")
if not DATA_DIR.exists():
    os.makedirs(DATA_DIR)

def generate_samples():
    print("[PROCESS] Generating specialized test samples...")

    # --- 1. NEW ASSETS (Ingestion Test) ---
    new_assets = []
    for i in range(50):
        new_assets.append({
            'asset_id': f"AST-500{i}",
            'model_name': 'Dell Latitude 5440',
            'initial_age': 0,
            'current_temp': 38.5,
            'current_usage': 10.0,
            'maint_score': 10,
            'repairs': 0,
            'sync_timestamp': datetime.now().isoformat()
        })
    pd.DataFrame(new_assets).to_csv(DATA_DIR / "sample_new_assets.csv", index=False)

    # --- 2. FRESH UPDATES (Upsert Test) ---
    # Assuming IDs AST-3000 to AST-3010 exist in DB
    updates_fresh = []
    for i in range(10):
        updates_fresh.append({
            'asset_id': f"AST-300{i}",
            'model_name': 'Dell Latitude 5440',
            'initial_age': 12, # Original age
            'current_temp': 88.0, # Intentional spike to see status change
            'current_usage': 65.0,
            'maint_score': 2,
            'repairs': 1,
            'sync_timestamp': (datetime.now() + timedelta(days=1)).isoformat()
        })
    pd.DataFrame(updates_fresh).to_csv(DATA_DIR / "sample_updates_fresh.csv", index=False)

    # --- 3. STALE UPDATES (Conflict Test) ---
    updates_stale = []
    for i in range(10):
        updates_stale.append({
            'asset_id': f"AST-301{i}",
            'model_name': 'Dell Latitude 5440',
            'current_temp': 40.0,
            'sync_timestamp': "2022-01-01T00:00:00" # Very old
        })
    pd.DataFrame(updates_stale).to_csv(DATA_DIR / "sample_updates_stale.csv", index=False)

    # --- 4. DIRTY DATA (Sanitization Test) ---
    dirty_data = [
        # Impossible Temp
        {'asset_id': 'AST-9999', 'model_name': 'Dell Latitude 5440', 'current_temp': 999.9, 'current_usage': 20.0, 'maint_score': 10, 'repairs': 0},
        # String instead of Number
        {'asset_id': 'AST-8888', 'model_name': 'Dell Latitude 5440', 'current_temp': "VERY_HOT", 'current_usage': 20.0, 'maint_score': 10, 'repairs': 0},
        # Missing ID
        {'asset_id': None, 'model_name': 'Dell Latitude 5440', 'current_temp': 45.0, 'current_usage': 20.0, 'maint_score': 10, 'repairs': 0},
        # Unknown Model
        {'asset_id': 'AST-7777', 'model_name': 'Super-Gaming-PC-9000', 'current_temp': 45.0, 'current_usage': 20.0, 'maint_score': 10, 'repairs': 0}
    ]
    pd.DataFrame(dirty_data).to_csv(DATA_DIR / "sample_dirty_data.csv", index=False)

    print(f"[SUCCESS] 4 test files generated in {DATA_DIR}")

if __name__ == "__main__":
    generate_samples()