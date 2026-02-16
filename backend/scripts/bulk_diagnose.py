import sys
import os

# Ensure we can import from the 'app' directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.models.schemas import Asset, Spec
from app.core.engine import engine

def run_bulk_diagnostic():
    """
    Meticulously processes all 'Unscored' assets in the database.
    This bridges the gap between raw data migration and the ML Dashboard.
    """
    db = SessionLocal()
    try:
        print("-" * 50)
        print("OPTIASET BULK DIAGNOSTIC SYSTEM")
        print("-" * 50)

        # 1. Fetch assets that need scoring
        assets_to_score = db.query(Asset).filter(Asset.health_score == "Unscored").all()
        total = len(assets_to_score)

        if total == 0:
            print("[INFO] All assets are already scored. No action needed.")
            return

        print(f"[PROCESS] Analyzing {total} assets...")

        processed_count = 0
        for asset in assets_to_score:
            # Get specs for ratio calculation
            spec = db.query(Spec).filter(Spec.model_name == asset.model_name).first()

            if not spec:
                print(f"[SKIP] {asset.asset_id}: No manufacturer specs found.")
                continue

            # Engineer features and predict
            features = engine.prepare_features(asset, spec)
            label, cluster_id = engine.predict_health(features)

            # Update DB
            asset.health_score = label
            asset.cluster_id = cluster_id
            processed_count += 1

            if processed_count % 100 == 0:
                print(f"[PROGRESS] {processed_count}/{total} completed...")

        db.commit()
        print("-" * 50)
        print(f"[SUCCESS] Fleet processing complete.")
        print(f"Total processed: {processed_count}")
        print("-" * 50)

    except Exception as e:
        print(f"[FATAL] Bulk diagnostic failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_bulk_diagnostic()