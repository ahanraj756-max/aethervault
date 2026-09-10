import os
import datetime
from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.models.file import File
from backend.app.models.folder import Folder
from backend.app.models.activity import ActivityLog
from backend.app.core.exceptions import NotFoundException, ForbiddenException
from backend.app.config import settings

def get_trash_items(db: Session, user: User) -> dict:
    """Retrieve all trashed files and folders for the user."""
    trashed_files = db.query(File).filter(
        File.user_id == user.id,
        File.is_trashed == True
    ).order_by(File.trashed_at.desc(), File.updated_at.desc()).all()

    trashed_folders = db.query(Folder).filter(
        Folder.user_id == user.id,
        Folder.is_trashed == True
    ).order_by(Folder.trashed_at.desc(), Folder.updated_at.desc()).all()

    total_size = sum(f.file_size for f in trashed_files)

    return {
        "files": trashed_files,
        "folders": trashed_folders,
        "total_items": len(trashed_files) + len(trashed_folders),
        "total_size": total_size
    }

def restore_file(db: Session, file_id: int, user: User) -> File:
    """Restore a single file from the recycle bin."""
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise NotFoundException("File not found in Recycle Bin", "FILE_NOT_FOUND")
    if db_file.user_id != user.id:
        raise ForbiddenException("You do not have access to this file")

    # If the parent folder is deleted or currently trashed, move to root
    if db_file.folder_id is not None:
        parent_folder = db.query(Folder).filter(Folder.id == db_file.folder_id).first()
        if not parent_folder or parent_folder.is_trashed:
            db_file.folder_id = None

    db_file.is_trashed = False
    db_file.trashed_at = None
    db.add(db_file)

    # Register activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="restore",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_file)
    return db_file

def permanent_delete_file(db: Session, file_id: int, user: User) -> None:
    """Permanently delete a file from disk and database, reclaiming storage quota."""
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise NotFoundException("File not found", "FILE_NOT_FOUND")
    if db_file.user_id != user.id:
        raise ForbiddenException("You do not have access to this file")

    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))
    file_path = os.path.join(user_dir, db_file.relative_path)

    # Delete physical file from disk
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    # Reclaim storage quota
    user.storage_used = max(0, user.storage_used - db_file.file_size)
    db.add(user)

    # Register activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="permanent_delete",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)

    db.delete(db_file)
    db.commit()

def _recursive_restore_folder_contents(db: Session, folder_id: int, user: User) -> None:
    """Recursively mark all nested files and subfolders as not trashed."""
    # Restore files in folder
    files = db.query(File).filter(File.folder_id == folder_id, File.user_id == user.id).all()
    for f in files:
        f.is_trashed = False
        f.trashed_at = None
        db.add(f)

    # Restore subfolders
    subfolders = db.query(Folder).filter(Folder.parent_id == folder_id, Folder.user_id == user.id).all()
    for sub in subfolders:
        sub.is_trashed = False
        sub.trashed_at = None
        db.add(sub)
        _recursive_restore_folder_contents(db, sub.id, user)

def restore_folder(db: Session, folder_id: int, user: User) -> Folder:
    """Restore a folder and all its contents from the recycle bin."""
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise NotFoundException("Folder not found in Recycle Bin", "FOLDER_NOT_FOUND")
    if db_folder.user_id != user.id:
        raise ForbiddenException("You do not have access to this folder")

    # If parent folder is deleted or currently trashed, attach to root
    if db_folder.parent_id is not None:
        parent_folder = db.query(Folder).filter(Folder.id == db_folder.parent_id).first()
        if not parent_folder or parent_folder.is_trashed:
            db_folder.parent_id = None

    db_folder.is_trashed = False
    db_folder.trashed_at = None
    db.add(db_folder)

    # Restore children recursively
    _recursive_restore_folder_contents(db, folder_id, user)

    # Register activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="restore",
        resource_type="folder",
        resource_id=db_folder.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_folder)
    return db_folder

def _recursive_permanent_delete_folder(db: Session, folder_id: int, user: User) -> None:
    """Recursively delete all physical files and subfolders."""
    files = db.query(File).filter(File.folder_id == folder_id, File.user_id == user.id).all()
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))

    for file in files:
        file_path = os.path.join(user_dir, file.relative_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

        user.storage_used = max(0, user.storage_used - file.file_size)
        db.delete(file)

    subfolders = db.query(Folder).filter(Folder.parent_id == folder_id, Folder.user_id == user.id).all()
    for sub in subfolders:
        _recursive_permanent_delete_folder(db, sub.id, user)
        db.delete(sub)

def permanent_delete_folder(db: Session, folder_id: int, user: User) -> None:
    """Permanently delete folder and all nested items from disk and database."""
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise NotFoundException("Folder not found", "FOLDER_NOT_FOUND")
    if db_folder.user_id != user.id:
        raise ForbiddenException("You do not have access to this folder")

    _recursive_permanent_delete_folder(db, folder_id, user)

    db_activity = ActivityLog(
        user_id=user.id,
        action="permanent_delete",
        resource_type="folder",
        resource_id=db_folder.id
    )
    db.add(db_activity)
    db.add(user)
    db.delete(db_folder)
    db.commit()

def restore_all_trash(db: Session, user: User) -> int:
    """Restore all items in the user's recycle bin."""
    trashed_folders = db.query(Folder).filter(Folder.user_id == user.id, Folder.is_trashed == True).all()
    trashed_files = db.query(File).filter(File.user_id == user.id, File.is_trashed == True).all()

    count = len(trashed_folders) + len(trashed_files)

    for folder in trashed_folders:
        folder.is_trashed = False
        folder.trashed_at = None
        if folder.parent_id is not None:
            parent = db.query(Folder).filter(Folder.id == folder.parent_id).first()
            if not parent or parent.is_trashed:
                folder.parent_id = None
        db.add(folder)

    for file in trashed_files:
        file.is_trashed = False
        file.trashed_at = None
        if file.folder_id is not None:
            parent = db.query(Folder).filter(Folder.id == file.folder_id).first()
            if not parent or parent.is_trashed:
                file.folder_id = None
        db.add(file)

    db_activity = ActivityLog(
        user_id=user.id,
        action="restore_all",
        resource_type="trash",
        resource_id=0
    )
    db.add(db_activity)
    db.commit()
    return count

def empty_trash(db: Session, user: User) -> int:
    """Permanently delete everything currently in the user's recycle bin."""
    trashed_files = db.query(File).filter(File.user_id == user.id, File.is_trashed == True).all()
    trashed_folders = db.query(Folder).filter(Folder.user_id == user.id, Folder.is_trashed == True).all()

    count = len(trashed_files) + len(trashed_folders)
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))

    # Delete all physical trashed files
    for file in trashed_files:
        file_path = os.path.join(user_dir, file.relative_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        user.storage_used = max(0, user.storage_used - file.file_size)
        db.delete(file)

    # Delete trashed folders (parent-first or cascade)
    for folder in trashed_folders:
        db.delete(folder)

    db.add(user)
    db_activity = ActivityLog(
        user_id=user.id,
        action="empty_trash",
        resource_type="trash",
        resource_id=0
    )
    db.add(db_activity)
    db.commit()
    return count
