import sys
import os
from pathlib import Path
from dulwich import porcelain

repo_path = Path(__file__).resolve().parent.parent

token = os.getenv("GITHUB_TOKEN")
if not token:
    sys.exit(0)

authenticated_url = f"https://{token}@github.com/Suvetha-E/Coimbatore-WaterShed.git"
repo = porcelain.open_repo(str(repo_path))

porcelain.add(str(repo_path))

try:
    commit_id = porcelain.commit(
        str(repo_path),
        message=b"Sync & Update: Coimbatore Watershed Intelligence Platform",
        author=b"Suvetha-E <suvetha@watershed.tn.gov.in>",
        committer=b"Suvetha-E <suvetha@watershed.tn.gov.in>"
    )
    print(f"Committed changes: {commit_id.decode('utf-8')}")
except Exception:
    pass

try:
    porcelain.push(repo, authenticated_url, refspecs=b"refs/heads/main:refs/heads/main")
    print("SUCCESS: Synced and pushed changes to GitHub repository!")
except Exception:
    try:
        porcelain.push(repo, authenticated_url, refspecs=b"HEAD:refs/heads/main")
        print("SUCCESS: Synced HEAD to GitHub repository!")
    except Exception as ex:
        print(f"Git push sync note: {ex}")
