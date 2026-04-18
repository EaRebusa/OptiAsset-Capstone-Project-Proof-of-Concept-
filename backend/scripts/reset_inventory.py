import sys
import os

# Fix pathing so the script can find the 'app' module
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.session import SessionLocal
from app.models.schemas import Asset, SystemLog

def reset_inventory():
    print("WARNING: This will hard delete ALL assets (active and archived) from the database.")
    confirm = input("Type 'PURGE' to confirm: ")
    
    if confirm == 'PURGE':
        db = SessionLocal()
        try:
            count = db.query(Asset).delete()
            # Add an audit log for the script action
            log = SystemLog(action_type="DELETE", entity_type="ASSET", entity_id="SCRIPT_PURGE", details=f"Developer script hard purged {count} assets.")
            db.add(log)
            db.commit()
            print(f"[SUCCESS] Permanently deleted {count} assets from the database. Logs and Specs remain intact.")
        except Exception as e:
            db.rollback()
            print(f"[ERROR] Failed to purge inventory: {e}")
        finally:
            db.close()
    else:
        print("Operation cancelled.")

if __name__ == "__main__":
    reset_inventory()