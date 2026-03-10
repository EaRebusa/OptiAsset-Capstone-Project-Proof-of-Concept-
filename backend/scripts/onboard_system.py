import sys
import os
import pandas as pd

# Fix pathing so the script can find the 'app' module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal, engine, Base
from app.models.schemas import Spec, Asset

def onboard():
    """Initializes the SQLite DB and migrates your 0.55 score CSV."""
    print("[1/3] Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    # Seed Manufacturer Specs (The Ground Truth)
    specs_data = [
        {"type": "laptop", "name": "Dell Latitude 5440", "t": 47.5, "u": 27.5, "w": 36},
        {"type": "laptop", "name": "HP EliteBook 840", "t": 47.5, "u": 27.5, "w": 36},
        {"type": "desktop", "name": "Dell OptiPlex 7000", "t": 41.5, "u": 37.5, "w": 36},
        {"type": "desktop", "name": "HP ProDesk 400", "t": 41.5, "u": 37.5, "w": 36},
        # Generic Fallbacks
        {"type": "desktop", "name": "Generic Desktop", "t": 45.0, "u": 40.0, "w": 12},
        {"type": "laptop", "name": "Generic Laptop", "t": 50.0, "u": 30.0, "w": 12},
    ]

    print("[2/3] Seeding Specs Library...")
    for s in specs_data:
        if not db.query(Spec).filter(Spec.model_name == s["name"]).first():
            db.add(Spec(
                device_type=s["type"], model_name=s["name"],
                temp_norm=s["t"], usage_norm=s["u"], warranty_months=s["w"]
            ))
    db.commit()

    # Import your generated 1,200 row dataset
    # Robust pathing: CSV is in backend/data/
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # .../backend
    csv_path = os.path.join(base_dir, "data", "optiasset_inventory_1200.csv")

    if os.path.exists(csv_path):
        print(f"[3/3] Importing assets from {csv_path}...")
        df = pd.read_csv(csv_path)
        for _, row in df.iterrows():
            if not db.query(Asset).filter(Asset.asset_id == row['asset_id']).first():
                db.add(Asset(
                    asset_id=row['asset_id'],
                    model_name=row['model_name'],
                    initial_age=row['initial_age'],
                    current_temp=row['current_temp'],
                    current_usage=row['current_usage'],
                    maint_score=row['maint_score'],
                    repairs=row['repairs']
                ))
        db.commit()
        print(f"[SUCCESS] {len(df)} assets migrated to SQLite.")
    else:
        print(f"[ERROR] CSV not found at {csv_path}. Run generate_data.py first.")

    db.close()

if __name__ == "__main__":
    onboard()