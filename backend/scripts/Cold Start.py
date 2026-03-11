import sys
import os
from pathlib import Path

# --- FIX: Ensure 'app' module is importable ---
# We add the parent directory of 'scripts' (which is 'backend') to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_root))

from app.db.session import SessionLocal, engine
from app.models.schemas import Spec, Asset, Base

def setup_cold_start():
    print("🚀 [DEMO SETUP] Initializing Cold Start environment...")

    # 1. Path & Artifact Check
    data_dir = backend_root / "data"
    
    # Check if critical ML artifacts exist
    artifacts = [
        (data_dir / "model.pkl", "ML Model"),
        (data_dir / "scaler.pkl", "Scaler Object")
    ]
    
    missing_artifacts = []
    for art_path, art_name in artifacts:
        if not art_path.exists():
            missing_artifacts.append(art_name)

    if missing_artifacts:
        print(f"❌ [CRITICAL] Missing Artifacts: {', '.join(missing_artifacts)}")
        print("   The system cannot predict health scores without these.")
        print("   👉 Run 'backend/generate_data.py' or 'train_model.py' first.")
        return

    # 2. Database Reset (Surgical)
    print("🧹 [1/3] Wiping existing inventory records...")
    db = SessionLocal()
    try:
        # We drop and recreate the Asset table to ensure a clean slate
        # This is safer than DELETE FROM because it resets auto-increment IDs
        Asset.__table__.drop(engine)
        Asset.__table__.create(engine)
        print("   ✅ Assets table purged and reset.")
    except Exception as e:
        print(f"   ❌ Error during table reset: {e}")
        return

    # 3. Seed Specs Library (Required for ingestion)
    try:
        print("📚 [2/3] Seeding Specs Library baselines...")
        
        # Define baseline specs for demo devices
        specs_data = [
            {"device_type": "laptop", "model_name": "Dell Latitude 5440", "temp_norm": 47.5, "usage_norm": 27.5, "warranty_months": 36},
            {"device_type": "laptop", "model_name": "HP EliteBook 840", "temp_norm": 47.5, "usage_norm": 27.5, "warranty_months": 36},
            {"device_type": "desktop", "model_name": "Dell OptiPlex 7000", "temp_norm": 41.5, "usage_norm": 37.5, "warranty_months": 36},
            {"device_type": "desktop", "model_name": "HP ProDesk 400", "temp_norm": 41.5, "usage_norm": 37.5, "warranty_months": 36},
            # Fallbacks
            {"device_type": "laptop", "model_name": "Generic Laptop", "temp_norm": 50.0, "usage_norm": 30.0, "warranty_months": 12},
            {"device_type": "desktop", "model_name": "Generic Desktop", "temp_norm": 45.0, "usage_norm": 40.0, "warranty_months": 12},
        ]

        added_count = 0
        for s in specs_data:
            exists = db.query(Spec).filter(Spec.model_name == s["model_name"]).first()
            if not exists:
                new_spec = Spec(
                    device_type=s["device_type"],
                    model_name=s["model_name"],
                    temp_norm=s["temp_norm"],
                    usage_norm=s["usage_norm"],
                    warranty_months=s["warranty_months"]
                )
                db.add(new_spec)
                added_count += 1
        
        db.commit()
        print(f"   ✅ Specs Library ready. ({added_count} new specs added)")

        # 4. Final Validation
        asset_count = db.query(Asset).count()
        print(f"🔍 [3/3] Final Check: {asset_count} assets in DB.")

        if asset_count == 0:
            print("\n✨ [SUCCESS] System is now 'Empty & Intelligent'.")
            print("   You are ready to showcase the Bulk Upload feature.")
        else:
            print("⚠️ Warning: Assets still exist in DB. Manual cleanup required.")

    except Exception as e:
        print(f"❌ [ERROR] Cold start failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    setup_cold_start()