import os
import shutil
import sys
from pathlib import Path
import subprocess
import time

def hard_reset():
    print("⚠️ [WARNING] Starting Hard Reset. All manual overrides and modifications will be lost.")

    # 1. Cleanup
    # Ensure we clean both the correct data directory and any accidental script-local data directories
    project_root = Path(__file__).resolve().parent.parent
    data_dir = project_root / "data"
    script_data_dir = Path(__file__).resolve().parent / "data"

    files_to_delete = ["optiasset.db", "model.pkl", "scaler.pkl", "optiasset_inventory_1200.csv"]

    # Clean main data directory
    for f in files_to_delete:
        target = data_dir / f
        if target.exists():
            try:
                os.remove(target)
                print(f"[CLEAN] Deleted {target}")
            except Exception as e:
                print(f"[ERROR] Could not delete {target}: {e}")
                print("🛑 CRITICAL: Database file is locked. Please STOP the running server (uvicorn) and try again.")
                sys.exit(1) # Abort immediately

    # Clean potential script-local data directory (ghost files)
    if script_data_dir.exists():
        for f in files_to_delete:
            target = script_data_dir / f
            if target.exists():
                try:
                    os.remove(target)
                    print(f"[CLEAN] Deleted ghost file {target}")
                except Exception as e:
                    print(f"[ERROR] Could not delete {target}: {e}")
                    # Ghost files usually don't lock the main app, but good to warn
    
    # Wait a moment for file system to catch up
    time.sleep(1)

    # 2. Sequential Re-run
    scripts = [
        "generate_data.py",
        "onboard_system.py",
        "train_model.py",
        "bulk_diagnose.py"
    ]

    for script in scripts:
        print(f"\n[RUNNING] {script}...")
        # Run scripts from the scripts directory
        result = subprocess.run(["python", script], capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__)))
        if result.returncode == 0:
            print(f"[SUCCESS] {script} finished.")
            if "SUCCESS" in result.stdout: # print interesting stdout parts
                 lines = result.stdout.split('\n')
                 for line in lines:
                     if "[SUCCESS]" in line:
                         print(f"  > {line.strip()}")
        else:
            print(f"[ERROR] {script} failed!")
            print(result.stdout)
            print(result.stderr)
            break

    print("\n✨ [COMPLETE] System is back to Ground Zero.")

if __name__ == "__main__":
    hard_reset()