import sys
import os
from pathlib import Path

# Pathing fix to find 'app' module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal, engine, Base
from app.models.schemas import Spec, Asset

def setup_cold_start():
    print("🚀 [DEMO SETUP] Initializing Cold Start environment...")

    # 1. Path & Artifact Check
    base_dir = Path(__file__).resolve().parent.parent
    data_dir = base_dir / "data"
    db_file = data_dir / "optiasset.db"

    artifacts = [data_dir / "model.pkl", data_dir / "scaler.pkl"]
    for art in artifacts:
        if not art.exists():
            print(f"❌ [CRITICAL] {art.name} missing! ML won't work without it.")
            print("Run 'train_model.py' before trying to demo.")
            return

    # 2. Database Reset (Surgical)
    print("[1/3] Wiping existing inventory records...")
    if db_file.exists():
        try:
            # We recreate tables to ensure a clean schema and zeroed sequences
            Base.metadata.drop_all(bind=engine, tables=[Asset.__table__])
            Base.metadata.create_all(bind=engine, tables=[Asset.__table__])
            print("✅ Assets table purged.")
        except Exception as e:
            print(f"❌ Error during table reset: {e}")
            return
    else:
        Base.metadata.create_all(bind=engine)

    # 3. Seed Specs Library (Required for ingestion)
    db = SessionLocal()
    try:
        print("[2/3] Seeding Specs Library baselines...")
        specs_data = [
            {"type": "laptop", "name": "Dell Latitude 5440", "t": 47.5, "u": 27.5, "w": 36},
            {"type": "laptop", "name": "HP EliteBook 840", "t": 47.5, "u": 27.5, "w": 36},
            {"type": "desktop", "name": "Dell OptiPlex 7000", "t": 41.5, "u": 37.5, "w": 36},
            {"type": "desktop", "name": "HP ProDesk 400", "t": 41.5, "u": 37.5, "w": 36},
            {"type": "laptop", "name": "Generic Laptop", "t": 50.0, "u": 30.0, "w": 12},
            {"type": "desktop", "name": "Generic Desktop", "t": 45.0, "u": 40.0, "w": 12},
        ]

        for s in specs_data:
            if not db.query(Spec).filter(Spec.model_name == s["name"]).first():
                db.add(Spec(
                    device_type=s["type"],
                    model_name=s["name"],
                    temp_norm=s["t"],
                    usage_norm=s["u"],
                    warranty_months=s["w"]
                ))
        db.commit()
        print("✅ Specs Library ready.")

        # 4. Final Validation
        asset_count = db.query(Asset).count()
        print(f"[3/3] Final Check: {asset_count} assets in DB.")

        if asset_count == 0:
            print("\n✨ [SUCCESS] System is now 'Empty & Intelligent'.")
            print("Ready to showcase the Bulk Upload feature.")
        else:
            print("⚠️ Warning: Assets still exist in DB. Manual cleanup required.")

    except Exception as e:
        print(f"❌ [ERROR] Cold start failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_cold_start()