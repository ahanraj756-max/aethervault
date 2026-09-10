from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.core.dependencies import get_current_user
from backend.app.schemas.trash import TrashContentsResponse
from backend.app.schemas.files import FileResponse
from backend.app.schemas.folders import FolderResponse
from backend.app.services import trash_service

router = APIRouter()

@router.get("", response_model=dict)
def get_trash_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve all trashed files and folders for current user."""
    items = trash_service.get_trash_items(db, current_user)
    return {
        "success": True,
        "data": {
            "files": [FileResponse.model_validate(f) for f in items["files"]],
            "folders": [FolderResponse.model_validate(fold) for fold in items["folders"]],
            "total_items": items["total_items"],
            "total_size": items["total_size"]
        }
    }

@router.post("/files/{file_id}/restore", response_model=dict)
def restore_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a file from Recycle Bin."""
    restored = trash_service.restore_file(db, file_id, current_user)
    return {
        "success": True,
        "message": f"Restored '{restored.original_filename}' successfully",
        "data": FileResponse.model_validate(restored)
    }

@router.delete("/files/{file_id}/permanent", response_model=dict)
def permanent_delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a file from Recycle Bin and reclaim quota."""
    trash_service.permanent_delete_file(db, file_id, current_user)
    return {
        "success": True,
        "message": "File permanently deleted"
    }

@router.post("/folders/{folder_id}/restore", response_model=dict)
def restore_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a folder and all its contents from Recycle Bin."""
    restored = trash_service.restore_folder(db, folder_id, current_user)
    return {
        "success": True,
        "message": f"Restored folder '{restored.name}' successfully",
        "data": FolderResponse.model_validate(restored)
    }

@router.delete("/folders/{folder_id}/permanent", response_model=dict)
def permanent_delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a folder and all its contents, reclaiming quota."""
    trash_service.permanent_delete_folder(db, folder_id, current_user)
    return {
        "success": True,
        "message": "Folder permanently deleted"
    }

@router.post("/restore-all", response_model=dict)
def restore_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore all files and folders in the Recycle Bin."""
    count = trash_service.restore_all_trash(db, current_user)
    return {
        "success": True,
        "message": f"Restored {count} item(s) from Recycle Bin",
        "data": {"restored_count": count}
    }

@router.delete("/empty", response_model=dict)
def empty_trash(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently empty the entire Recycle Bin."""
    count = trash_service.empty_trash(db, current_user)
    return {
        "success": True,
        "message": f"Permanently deleted {count} item(s) from Recycle Bin",
        "data": {"deleted_count": count}
    }
