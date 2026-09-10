import os
from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.models.folder import Folder
from backend.app.models.file import File
from backend.app.models.activity import ActivityLog
from backend.app.schemas.folders import FolderCreate, FolderUpdate
from backend.app.core.exceptions import NotFoundException, ForbiddenException, DuplicateException
import datetime
from backend.app.config import settings

def get_folder_by_id(db: Session, folder_id: int, user: User, include_trashed: bool = False) -> Folder:
    query = db.query(Folder).filter(Folder.id == folder_id)
    if not include_trashed:
        query = query.filter(Folder.is_trashed == False)
    folder = query.first()
    if not folder:
        raise NotFoundException("Folder not found", "FOLDER_NOT_FOUND")
    if folder.user_id != user.id:
        raise ForbiddenException("You do not have access to this folder")
    return folder

def check_duplicate_name(db: Session, user_id: int, parent_id: int | None, name: str) -> None:
    existing = db.query(Folder).filter(
        Folder.user_id == user_id,
        Folder.parent_id == parent_id,
        Folder.name == name,
        Folder.is_trashed == False
    ).first()
    if existing:
        raise DuplicateException(f"A folder named '{name}' already exists in this directory")

def create_folder(db: Session, data: FolderCreate, user: User) -> Folder:
    # Verify parent folder ownership
    if data.parent_id is not None:
        get_folder_by_id(db, data.parent_id, user)
        
    check_duplicate_name(db, user.id, data.parent_id, data.name)
    
    db_folder = Folder(
        user_id=user.id,
        name=data.name,
        parent_id=data.parent_id
    )
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="create",
        resource_type="folder",
        resource_id=db_folder.id
    )
    db.add(db_activity)
    db.commit()
    
    return db_folder

def get_folder_contents(db: Session, folder_id: int | None, user: User) -> dict:
    if folder_id is not None:
        # Check folder ownership
        get_folder_by_id(db, folder_id, user)
        
    folders = db.query(Folder).filter(
        Folder.user_id == user.id,
        Folder.parent_id == folder_id,
        Folder.is_trashed == False
    ).order_by(Folder.name.asc()).all()
    
    files = db.query(File).filter(
        File.user_id == user.id,
        File.folder_id == folder_id,
        File.is_trashed == False
    ).order_by(File.original_filename.asc()).all()
    
    return {
        "folders": folders,
        "files": files
    }

def rename_folder(db: Session, folder_id: int, data: FolderUpdate, user: User) -> Folder:
    folder = get_folder_by_id(db, folder_id, user)
    
    # Check duplicate names in parent
    check_duplicate_name(db, user.id, folder.parent_id, data.name)
    
    folder.name = data.name
    db.add(folder)
    
    db_activity = ActivityLog(
        user_id=user.id,
        action="rename",
        resource_type="folder",
        resource_id=folder.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(folder)
    return folder

def is_circular_reference(db: Session, folder_id: int, target_parent_id: int | None) -> bool:
    """Traverse parent tree upwards to check for folder cycle creation."""
    if target_parent_id is None:
        return False
    if folder_id == target_parent_id:
        return True
        
    current = db.query(Folder).filter(Folder.id == target_parent_id).first()
    while current and current.parent_id is not None:
        if current.parent_id == folder_id:
            return True
        current = db.query(Folder).filter(Folder.id == current.parent_id).first()
        
    return False

def move_folder(db: Session, folder_id: int, target_parent_id: int | None, user: User) -> Folder:
    folder = get_folder_by_id(db, folder_id, user)
    
    if target_parent_id is not None:
        get_folder_by_id(db, target_parent_id, user)
        
    if is_circular_reference(db, folder_id, target_parent_id):
        raise ForbiddenException("Cannot move a folder inside itself or its children subfolders")
        
    # Check name collisions in destination
    check_duplicate_name(db, user.id, target_parent_id, folder.name)
    
    folder.parent_id = target_parent_id
    db.add(folder)
    
    db_activity = ActivityLog(
        user_id=user.id,
        action="move",
        resource_type="folder",
        resource_id=folder.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(folder)
    return folder

def _recursive_trash_folder(db: Session, folder_id: int, user: User, now_time: datetime.datetime) -> None:
    # 1. Soft delete files in this folder
    files = db.query(File).filter(File.folder_id == folder_id, File.user_id == user.id).all()
    for file in files:
        file.is_trashed = True
        file.trashed_at = now_time
        db.add(file)
        
    # 2. Soft delete subfolders
    subfolders = db.query(Folder).filter(Folder.parent_id == folder_id, Folder.user_id == user.id).all()
    for sub in subfolders:
        sub.is_trashed = True
        sub.trashed_at = now_time
        db.add(sub)
        _recursive_trash_folder(db, sub.id, user, now_time)

def delete_folder(db: Session, folder_id: int, user: User) -> None:
    """Soft delete folder: move to Recycle Bin along with its contents."""
    folder = get_folder_by_id(db, folder_id, user)
    now_time = datetime.datetime.now(datetime.timezone.utc)
    
    folder.is_trashed = True
    folder.trashed_at = now_time
    db.add(folder)
    
    # Soft delete recursive contents
    _recursive_trash_folder(db, folder.id, user, now_time)
    
    # Record Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="trash",
        resource_type="folder",
        resource_id=folder.id
    )
    db.add(db_activity)
    db.commit()

def cleanup_temp_file(file_path: str) -> None:
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass

def _add_folder_to_zip(db: Session, folder_id: int, user: User, user_dir: str, current_path: str, zip_file) -> None:
    # 1. Fetch subfolders
    subfolders = db.query(Folder).filter(
        Folder.parent_id == folder_id,
        Folder.user_id == user.id,
        Folder.is_trashed == False
    ).order_by(Folder.name.asc()).all()

    # 2. Fetch files
    files = db.query(File).filter(
        File.folder_id == folder_id,
        File.user_id == user.id,
        File.is_trashed == False
    ).order_by(File.original_filename.asc()).all()

    # If folder is empty (no subfolders and no files), record empty directory entry
    if not subfolders and not files:
        zip_file.writestr(f"{current_path}/", "")
        return

    # Add all files in current folder
    for f in files:
        file_physical_path = os.path.join(user_dir, f.relative_path)
        if os.path.exists(file_physical_path):
            arcname = f"{current_path}/{f.original_filename}"
            zip_file.write(file_physical_path, arcname=arcname)

    # Recursively traverse all subfolders
    for sub in subfolders:
        sub_path = f"{current_path}/{sub.name}"
        _add_folder_to_zip(db, sub.id, user, user_dir, sub_path, zip_file)

def create_folder_zip(db: Session, folder_id: int, user: User) -> tuple[str, str]:
    import zipfile
    import uuid
    from backend.app.utils.file_utils import sanitize_filename

    folder = get_folder_by_id(db, folder_id, user)
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))
    temp_dir = os.path.join(user_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)

    clean_name = sanitize_filename(folder.name) or "folder"
    zip_filename = f"{clean_name}.zip"
    temp_zip_name = f"folder_download_{uuid.uuid4()}.zip"
    temp_zip_path = os.path.join(temp_dir, temp_zip_name)

    with zipfile.ZipFile(temp_zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        _add_folder_to_zip(db, folder.id, user, user_dir, folder.name, zip_file)

    # Register download activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="download",
        resource_type="folder",
        resource_id=folder.id
    )
    db.add(db_activity)
    db.commit()

    return temp_zip_path, zip_filename

