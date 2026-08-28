import sys
import os
from pathlib import Path
from dulwich import porcelain

repo_path = Path(__file__).resolve().parent.parent

# Read token strictly from environment variable to prevent secret scanning violations
token = os.getenv("GITHUB_TOKEN")
if not token:
    print("Notice: GITHUB_TOKEN environment variable not set. Please export GITHUB_TOKEN.")
    sys.exit(0)

authenticated_url = f"https://{token}@github.com/Suvetha-E/Coimbatore-WaterShed.git"

print(f"Opening repository at {repo_path}...")
repo = porcelain.open_repo(str(repo_path))

porcelain.add(str(repo_path))

try:
    commit_id = porcelain.commit(
        str(repo_path),
        message=b"Sync & Push: Coimbatore Watershed Intelligence Platform features",
        author=b"Suvetha-E <suvetha@watershed.tn.gov.in>",
        committer=b"Suvetha-E <suvetha@watershed.tn.gov.in>"
    )
    print(f"Committed changes: {commit_id.decode('utf-8')}")
except Exception as e:
    print(f"Commit note: {e}")

print("Pushing to GitHub main branch...")
try:
    porcelain.push(repo, authenticated_url, refspecs=b"refs/heads/main:refs/heads/main")
    print("SUCCESS: Pushed to GitHub main branch successfully!")
except Exception as e:
    try:
        porcelain.push(repo, authenticated_url, refspecs=b"HEAD:refs/heads/main")
        print("SUCCESS: Pushed HEAD to GitHub main branch successfully!")
    except Exception as ex:
        print(f"Error pushing to GitHub: {ex}")
