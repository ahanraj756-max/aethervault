from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.user import User
from backend.app.models.file import File

def get_duplicate_files(db: Session, user: User) -> list[dict]:
    """Identify and group files that share identical SHA-256 hashes."""
    # Find hashes with count > 1 for this user among non-trashed files
    duplicate_hashes = db.query(File.file_hash).filter(
        File.user_id == user.id,
        File.is_trashed == False
    ).group_by(File.file_hash).having(
        func.count(File.id) > 1
    ).all()
    
    hash_list = [h[0] for h in duplicate_hashes]
    
    if not hash_list:
        return []
        
    # Get all non-trashed files with duplicate hashes
    files = db.query(File).filter(
        File.user_id == user.id,
        File.is_trashed == False,
        File.file_hash.in_(hash_list)
    ).all()
    
    # Group file objects
    groups = {}
    for file in files:
        h = file.file_hash
        if h not in groups:
            groups[h] = {
                "file_hash": h,
                "file_size": file.file_size,
                "locations": [],
                "num_duplicates": 0
            }
        groups[h]["locations"].append(file)
        groups[h]["num_duplicates"] += 1
        
    return list(groups.values())
