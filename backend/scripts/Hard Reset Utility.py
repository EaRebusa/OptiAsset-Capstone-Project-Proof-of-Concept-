import os
import shutil
from pathlib import Path
import subprocess

def hard_reset():
    print("⚠️ [WARNING] Starting Hard Reset. All manual overrides and modifications will be lost.")

    # 1. Cleanup
    data_dir = Path("../data")
    files_to_delete = ["optiasset.db", "model.pkl", "scaler.pkl", "optiasset_inventory_1200.csv"]

    for f in files_to_delete:
        target = data_dir / f
        if target.exists():
            os.remove(target)
            print(f"[CLEAN] Deleted {f}")

    # 2. Sequential Re-run
    scripts = [
        "generate_data.py",
        "onboard_system.py",
        "train_model.py",
        "bulk_diagnose.py"
    ]

    for script in scripts:
        print(f"\n[RUNNING] {script}...")
        result = subprocess.run(["python", script], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[SUCCESS] {script} finished.")
        else:
            print(f"[ERROR] {script} failed!")
            print(result.stderr)
            break

    print("\n✨ [COMPLETE] System is back to Ground Zero.")

if __name__ == "__main__":
    # Ensure we are in the scripts directory context
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    hard_reset()