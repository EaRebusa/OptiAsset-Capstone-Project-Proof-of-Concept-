import os
import shutil
from pathlib import Path
import subprocess

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
            print(result.stdout) # Print stdout to see progress
        else:
            print(f"[ERROR] {script} failed!")
            print(result.stderr)
            break

    print("\n✨ [COMPLETE] System is back to Ground Zero.")

if __name__ == "__main__":
    hard_reset()