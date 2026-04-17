import shutil
import os

dirs_to_remove = [
    r"c:\counsltant\consultant AI",
    r"c:\counsltant\app\copilot"
]

for d in dirs_to_remove:
    if os.path.exists(d):
        try:
            shutil.rmtree(d)
            print(f"Successfully removed {d}")
        except Exception as e:
            print(f"Error removing {d}: {e}")
    else:
        print(f"Directory {d} does not exist")
