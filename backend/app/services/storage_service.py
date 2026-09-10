from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.models.file import File
from backend.app.models.folder import Folder
from backend.app.utils.file_utils import get_file_category

def get_storage_stats(db: Session, user: User) -> dict:
    """Calculate quota limits, current usage percentages, file count totals, and category breakdowns."""
    total_quota = user.storage_quota
    used_storage = user.storage_used
    available_storage = max(0, total_quota - used_storage)
    usage_percentage = round((used_storage / total_quota) * 100, 2) if total_quota > 0 else 0.0
    
    num_files = db.query(File).filter(File.user_id == user.id, File.is_trashed == False).count()
    num_folders = db.query(Folder).filter(Folder.user_id == user.id, Folder.is_trashed == False).count()
    num_trashed_files = db.query(File).filter(File.user_id == user.id, File.is_trashed == True).count()
    num_trashed_folders = db.query(Folder).filter(Folder.user_id == user.id, Folder.is_trashed == True).count()
    
    # Calculate storage breakdown by category for active files
    files_data = db.query(File.extension, File.file_size).filter(File.user_id == user.id, File.is_trashed == False).all()
    
    storage_by_type = {
        "document": 0,
        "image": 0,
        "video": 0,
        "audio": 0,
        "archive": 0,
        "other": 0
    }
    
    for ext, size in files_data:
        category = get_file_category(ext)
        storage_by_type[category] = storage_by_type.get(category, 0) + size
        
    return {
        "total_quota": total_quota,
        "used_storage": used_storage,
        "available_storage": available_storage,
        "usage_percentage": usage_percentage,
        "num_files": num_files,
        "num_folders": num_folders,
        "num_trashed": num_trashed_files + num_trashed_folders,
        "storage_by_type": storage_by_type
    }

def get_largest_files(db: Session, user: User, limit: int = 10) -> list[File]:
    """Retrieve the user's largest active stored files."""
    return db.query(File).filter(
        File.user_id == user.id,
        File.is_trashed == False
    ).order_by(File.file_size.desc()).limit(limit).all()

def get_recent_files(db: Session, user: User, limit: int = 10) -> list[File]:
    """Retrieve the user's recently active uploaded files."""
    return db.query(File).filter(
        File.user_id == user.id,
        File.is_trashed == False
    ).order_by(File.created_at.desc()).limit(limit).all()
