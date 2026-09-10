import os
import shutil
import uuid
import datetime
from sqlalchemy.orm import Session
from fastapi import UploadFile

from backend.app.models.user import User
from backend.app.models.file import File
from backend.app.models.folder import Folder
from backend.app.models.ai_metadata import AIMetadata
from backend.app.models.activity import ActivityLog
from backend.app.core.exceptions import NotFoundException, ForbiddenException, QuotaExceededException
from backend.app.utils.file_utils import sanitize_filename, get_file_category
from backend.app.utils.hashing import calculate_sha256
from backend.app.config import settings

def get_file_by_id(db: Session, file_id: int, user: User, include_trashed: bool = False) -> File:
    query = db.query(File).filter(File.id == file_id)
    if not include_trashed:
        query = query.filter(File.is_trashed == False)
    file = query.first()
    if not file:
        raise NotFoundException("File not found", "FILE_NOT_FOUND")
    if file.user_id != user.id:
        raise ForbiddenException("You do not have access to this file")
    return file

def check_folder_ownership(db: Session, folder_id: int | None, user_id: int) -> Folder | None:
    if folder_id is None:
        return None
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise NotFoundException("Destination folder not found", "FOLDER_NOT_FOUND")
    if folder.user_id != user_id:
        raise ForbiddenException("You do not have access to this folder")
    return folder

def resolve_filename_collision(db: Session, user_id: int, folder_id: int | None, filename: str) -> str:
    """Resolve filename collision by appending suffix numbers like 'name (1).ext'."""
    base, ext = os.path.splitext(filename)
    counter = 1
    new_filename = filename
    
    # Check if a file with the same name already exists in this folder
    while db.query(File).filter(
        File.user_id == user_id,
        File.folder_id == folder_id,
        File.original_filename == new_filename
    ).first():
        new_filename = f"{base} ({counter}){ext}"
        counter += 1
        
    return new_filename

async def upload_file(db: Session, user: User, file: UploadFile, folder_id: int | None = None) -> File:
    # 1. Validate destination folder ownership
    check_folder_ownership(db, folder_id, user.id)
    
    # 2. Setup user storage sandbox directories
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))
    files_dir = os.path.join(user_dir, "files")
    temp_dir = os.path.join(user_dir, "temp")
    os.makedirs(files_dir, exist_ok=True)
    os.makedirs(temp_dir, exist_ok=True)
    
    # 3. Stream upload contents to a temporary file to calculate size and hash safely
    temp_stored_name = f"upload_{uuid.uuid4()}.tmp"
    temp_file_path = os.path.join(temp_dir, temp_stored_name)
    
    file_size = 0
    try:
        with open(temp_file_path, "wb") as buffer:
            while chunk := await file.read(65536):
                buffer.write(chunk)
                file_size += len(chunk)
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise e
        
    # 4. Check file size limits and quota enforcement
    max_size_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_size > max_size_bytes:
        os.remove(temp_file_path)
        raise QuotaExceededException(f"File size exceeds maximum upload limit of {settings.MAX_UPLOAD_SIZE_MB}MB")
        
    if user.storage_used + file_size > user.storage_quota:
        os.remove(temp_file_path)
        raise QuotaExceededException("Insufficient storage quota to upload this file")
        
    # 5. Process clean filename and cryptographic hash
    original_name = sanitize_filename(file.filename or "unnamed")
    original_name = resolve_filename_collision(db, user.id, folder_id, original_name)
    
    file_hash = calculate_sha256(temp_file_path)
    extension = os.path.splitext(original_name)[1].lower()
    
    # 6. Copy to permanent store with UUID physical name
    stored_name = f"{uuid.uuid4()}{extension}"
    final_file_path = os.path.join(files_dir, stored_name)
    shutil.move(temp_file_path, final_file_path)
    
    # 7. Create File database record
    db_file = File(
        user_id=user.id,
        folder_id=folder_id,
        original_filename=original_name,
        stored_filename=stored_name,
        relative_path=f"files/{stored_name}",
        mime_type=file.content_type or "application/octet-stream",
        extension=extension,
        file_size=file_size,
        file_hash=file_hash,
        is_favorite=False
    )
    db.add(db_file)
    db.flush()
    
    # Update user quota usage
    user.storage_used += file_size
    db.add(user)
    
    # Set up pending AI metadata placeholder
    db_ai = AIMetadata(
        file=db_file,
        processing_status="pending"
    )
    db.add(db_ai)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="upload",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    
    db.commit()
    db.refresh(db_file)
    return db_file

def get_file_download_path(db: Session, file_id: int, user: User) -> tuple[str, str]:
    db_file = get_file_by_id(db, file_id, user)
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))
    file_path = os.path.join(user_dir, db_file.relative_path)
    
    if not os.path.exists(file_path):
        # Physical mismatch: log error and raise
        # For security reasons we throw NotFoundException
        raise NotFoundException("Physical file is missing from server storage", "PHYSICAL_FILE_MISSING")
        
    # Log download activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="download",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    db.commit()
    
    return file_path, db_file.original_filename

def delete_file(db: Session, file_id: int, user: User) -> None:
    """Soft delete file: move to Recycle Bin."""
    db_file = get_file_by_id(db, file_id, user)
    db_file.is_trashed = True
    db_file.trashed_at = datetime.datetime.now(datetime.timezone.utc)
    db.add(db_file)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="trash",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    db.commit()

def rename_file(db: Session, file_id: int, new_name: str, user: User) -> File:
    db_file = get_file_by_id(db, file_id, user)
    
    # Sanitize and resolve names
    sanitized = sanitize_filename(new_name)
    
    # Enforce original extension matching if missing from new name
    orig_ext = db_file.extension
    if not sanitized.lower().endswith(orig_ext):
        sanitized = f"{sanitized}{orig_ext}"
        
    resolved_name = resolve_filename_collision(db, user.id, db_file.folder_id, sanitized)
    
    db_file.original_filename = resolved_name
    db.add(db_file)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="rename",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_file)
    return db_file

def move_file(db: Session, file_id: int, folder_id: int | None, user: User) -> File:
    db_file = get_file_by_id(db, file_id, user)
    check_folder_ownership(db, folder_id, user.id)
    
    # Resolve name conflicts in destination folder
    resolved_name = resolve_filename_collision(db, user.id, folder_id, db_file.original_filename)
    
    db_file.folder_id = folder_id
    db_file.original_filename = resolved_name
    db.add(db_file)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="move",
        resource_type="file",
        resource_id=db_file.id
    )
    db.add(db_activity)
    db.commit()
    db.refresh(db_file)
    return db_file

def copy_file(db: Session, file_id: int, user: User) -> File:
    db_file = get_file_by_id(db, file_id, user)
    
    # Check quota
    if user.storage_used + db_file.file_size > user.storage_quota:
        raise QuotaExceededException("Insufficient storage quota to duplicate this file")
        
    # Get original paths
    user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{user.id}"))
    files_dir = os.path.join(user_dir, "files")
    original_path = os.path.join(user_dir, db_file.relative_path)
    
    if not os.path.exists(original_path):
        raise NotFoundException("Original physical file is missing", "PHYSICAL_FILE_MISSING")
        
    # Copy physical file
    stored_name = f"{uuid.uuid4()}{db_file.extension}"
    new_path = os.path.join(files_dir, stored_name)
    shutil.copy(original_path, new_path)
    
    # Resolve copied filename suffix
    base, ext = os.path.splitext(db_file.original_filename)
    copy_name = resolve_filename_collision(db, user.id, db_file.folder_id, f"{base} - Copy{ext}")
    
    # Save copy DB record
    db_copy = File(
        user_id=user.id,
        folder_id=db_file.folder_id,
        original_filename=copy_name,
        stored_filename=stored_name,
        relative_path=f"files/{stored_name}",
        mime_type=db_file.mime_type,
        extension=db_file.extension,
        file_size=db_file.file_size,
        file_hash=db_file.file_hash,
        is_favorite=False
    )
    db.add(db_copy)
    db.flush()
    
    # Update quota
    user.storage_used += db_file.file_size
    db.add(user)
    
    # Set up pending AI metadata placeholder
    db_ai = AIMetadata(
        file=db_copy,
        processing_status="pending"
    )
    db.add(db_ai)
    
    # Register Activity
    db_activity = ActivityLog(
        user_id=user.id,
        action="copy",
        resource_type="file",
        resource_id=db_copy.id
    )
    db.add(db_activity)
    
    db.commit()
    db.refresh(db_copy)
    return db_copy

def toggle_favorite(db: Session, file_id: int, user: User) -> File:
    db_file = get_file_by_id(db, file_id, user)
    db_file.is_favorite = not db_file.is_favorite
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    return db_file
