import pandas as pd
import numpy as np
import random
import os
from pathlib import Path

# -------------------------------------------------------------------
# CONFIGURATION
# -------------------------------------------------------------------
SEED_VALUE = 42
random.seed(SEED_VALUE)
np.random.seed(SEED_VALUE)

DEVICE_SPECS = {
    'laptop': {
        'models': ['Dell Latitude 5440', 'HP EliteBook 840'],
        'temp_range': (40.0, 55.0),
        'usage_range': (15.0, 40.0),
        'warranty': 36
    },
    'desktop': {
        'models': ['Dell OptiPlex 7000', 'HP ProDesk 400'],
        'temp_range': (35.0, 48.0),
        'usage_range': (20.0, 50.0),
        'warranty': 36
    }
}

DATA_DIR = Path("../data")
OUTPUT_FILE = DATA_DIR / "optiasset_inventory_1200.csv"

# -------------------------------------------------------------------
# CORE PHYSICS ENGINE (TIERED PROBABILITY)
# -------------------------------------------------------------------
def calculate_telemetry(spec, age_months):
    """
    Generates telemetry with distinct clusters for KMeans.
    Refined Tiered logic based on proponent-driven testing (Score: 0.48+).
    """
    # 1. Determine Health Tier based on Age (Probabilistic)
    # Tier 0: Healthy, Tier 1: Warning, Tier 2: Critical
    if age_months < 24:
        tier = np.random.choice([0, 1, 2], p=[0.92, 0.06, 0.02])
    elif age_months < 48:
        tier = np.random.choice([0, 1, 2], p=[0.25, 0.65, 0.10])
    else:
        tier = np.random.choice([0, 1, 2], p=[0.02, 0.28, 0.70])

    # 2. Temperature Logic (Celsius)
    min_t, max_t = spec['temp_range']
    avg_t = (min_t + max_t) / 2

    if tier == 0:
        base_temp = random.gauss(avg_t, 1.5) # Tight Healthy cluster
    elif tier == 1:
        base_temp = random.gauss(avg_t + 18.0, 3.0) # Clear 'Warning' jump
    else:
        base_temp = random.gauss(avg_t + 35.0, 5.0) # 'Critical' overheating

    final_temp = round(max(20.0, base_temp), 2)

    # 3. Usage Logic (Hours/Week)
    min_u, max_u = spec['usage_range']
    avg_u = (min_u + max_u) / 2

    if tier == 0:
        base_usage = random.gauss(avg_u, 2.5)
    elif tier == 1:
        base_usage = random.gauss(avg_u * 1.5, 4.0)
    else:
        base_usage = random.gauss(avg_u * 2.2, 6.0)

    final_usage = round(max(2.0, base_usage), 2)

    # 4. Maintenance & Repair Logic
    # Sharpening maintenance ranges to improve Silhouette Score
    if tier == 0:
        maint_score = random.randint(9, 10)
        repairs = 0
    elif tier == 1:
        maint_score = random.randint(5, 7)
        repairs = 0 if random.random() < 0.85 else 1
    else:
        maint_score = random.randint(1, 3)
        repairs = random.randint(2, 6)

    return final_temp, final_usage, maint_score, repairs

# -------------------------------------------------------------------
# EXECUTION
# -------------------------------------------------------------------
def generate_inventory(total_count=1200):
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    inventory = []
    # Balanced 50/50 mix
    types = ['laptop'] * (total_count // 2) + ['desktop'] * (total_count // 2)
    random.shuffle(types)

    for i, dev_type in enumerate(types):
        try:
            spec = DEVICE_SPECS[dev_type]
            age = random.randint(0, 72)
            temp, usage, maint, repairs = calculate_telemetry(spec, age)

            inventory.append({
                'asset_id': f"AST-{3000 + i}",
                'device_type': dev_type,
                'model_name': random.choice(spec['models']),
                'initial_age': age,
                'current_temp': temp,
                'current_usage': usage,
                'maint_score': maint,
                'repairs': repairs
            })
        except Exception as e:
            print(f"[ERROR] Asset {i} failed: {e}")

    df = pd.DataFrame(inventory)
    df.to_csv(OUTPUT_FILE, index=False)
    return df

if __name__ == "__main__":
    data = generate_inventory(1200)
    print(f"[SUCCESS] 1,200 units generated at {OUTPUT_FILE}")