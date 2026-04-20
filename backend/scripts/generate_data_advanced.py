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
# ADVANCED PHYSICS ENGINE (CONTINUOUS PROBABILITY)
# -------------------------------------------------------------------
def calculate_advanced_telemetry(spec, age_months):
    """
    Generates telemetry using a continuous probability curve based on
    the Age-to-Warranty Ratio (R_age). Eliminates statistical "cliffs".
    """
    # Calculate Age Ratio (Relative Lifecycle)
    r_age = age_months / spec['warranty']
    
    # 1. Continuous Probability Model for Degradation
    # Base probability of being "Stressed" (Not Healthy)
    # Formula: P(Stressed) = min(0.15 + (0.5 * R_age), 0.95)
    p_degraded = min(0.15 + (0.5 * r_age), 0.95)
    
    roll = random.random()
    if roll > p_degraded:
        tier = 0  # Healthy
    else:
        # It is degraded. Determine if it is Warning (Tier 1) or Critical (Tier 2).
        # The older it gets relative to its warranty, the more likely the degradation is severe.
        p_critical_given_degraded = min(0.10 + (0.40 * r_age), 0.85)
        
        if random.random() < p_critical_given_degraded:
            tier = 2  # Critical
        else:
            tier = 1  # Warning

    # 2. Temperature Logic (Celsius) - Gaussian variance around baselines
    min_t, max_t = spec['temp_range']
    avg_t = (min_t + max_t) / 2

    if tier == 0:
        base_temp = random.gauss(avg_t, 1.5) 
    elif tier == 1:
        base_temp = random.gauss(avg_t + 18.0, 3.0) 
    else:
        base_temp = random.gauss(avg_t + 35.0, 5.0) 

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
    types = ['laptop'] * (total_count // 2) + ['desktop'] * (total_count // 2)
    random.shuffle(types)

    for i, dev_type in enumerate(types):
        try:
            spec = DEVICE_SPECS[dev_type]
            # Give assets a highly varied age spread (0 to 72 months)
            age = random.randint(0, 72)
            temp, usage, maint, repairs = calculate_advanced_telemetry(spec, age)

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
    print(f"[SUCCESS] 1,200 units generated using Advanced Continuous Probability at {OUTPUT_FILE}")