import sys
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Fix pathing
backend_root = Path(__file__).resolve().parent.parent
sys.path.append(str(backend_root))

from app.db.session import SessionLocal
from app.models.schemas import Asset

def simulate_stale_data():
    db = SessionLocal()
    try:
        # Grab the first 5 active assets in the database
        assets = db.query(Asset).filter(Asset.is_active == True).limit(5).all()
        
        if not assets:
            print("❌ No active assets found. Upload your inventory first!")
            return
        
        # Time travel: Subtract 35 days from today
        stale_date = datetime.now(timezone.utc) - timedelta(days=35)
        
        for asset in assets:
            asset.last_updated = stale_date
            print(f"🕰️ Backdated {asset.asset_id} to {stale_date.strftime('%Y-%m-%d')}")
            
        db.commit()
        print("\n✅ Successfully simulated stale data! Go refresh your React dashboard.")
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    simulate_stale_data()