import sys
import os

# Pathing fix
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal, engine, Base
from app.models.schemas import Asset, Spec

def peek():
    """Quickly verify the contents of the SQLite database."""
    # Ensure tables exist before querying
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        asset_count = db.query(Asset).count()
        spec_count = db.query(Spec).count()

        print("-" * 30)
        print(f"DATABASE SUMMARY")
        print("-" * 30)
        print(f"Total Assets: {asset_count}")
        print(f"Total Specs:  {spec_count}")

        if asset_count > 0:
            print("\n[FIRST 5 ASSETS]")
            first_five = db.query(Asset).limit(5).all()
            for a in first_five:
                print(f"ID: {a.asset_id} | Model: {a.model_name} | Age: {a.initial_age}mo | Temp: {a.current_temp}°C")

    except Exception as e:
        print(f"[ERROR] Could not read DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    peek()