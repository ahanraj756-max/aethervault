from fastapi import APIRouter, Depends, Form, BackgroundTasks, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.folders import FolderResponse, FolderCreate, FolderUpdate
from backend.app.services import folder_service
from backend.app.schemas.files import FileResponse

router = APIRouter()


@router.post("", status_code=status.HTTP_201_CREATED)
def create_folder(
    data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = folder_service.create_folder(db, data, current_user)
    return {
        "success": True,
        "message": "Folder created successfully",
        "data": FolderResponse.model_validate(folder)
    }

@router.get("")
def list_folder_contents(
    parent_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = folder_service.get_folder_contents(db, parent_id, current_user)
    return {
        "success": True,
        "data": {
            "folders": [FolderResponse.model_validate(f) for f in contents["folders"]],
            "files": [FileResponse.model_validate(file) for file in contents["files"]]
        }
    }

@router.get("/{id}")
def get_folder_details(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = folder_service.get_folder_by_id(db, id, current_user)
    return {
        "success": True,
        "data": FolderResponse.model_validate(folder)
    }

@router.put("/{id}")
def rename_folder(
    id: int,
    data: FolderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder = folder_service.rename_folder(db, id, data, current_user)
    return {
        "success": True,
        "message": "Folder renamed successfully",
        "data": FolderResponse.model_validate(folder)
    }

@router.put("/{id}/move")
def move_folder(
    id: int,
    parent_id: Optional[int] = Form(None), # move folder to parent_id
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In forms, we can also use a small schema or direct parameter
    folder = folder_service.move_folder(db, id, parent_id, current_user)
    return {
        "success": True,
        "message": "Folder moved successfully",
        "data": FolderResponse.model_validate(folder)
    }

@router.delete("/{id}")
def delete_folder(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    folder_service.delete_folder(db, id, current_user)
    return {
        "success": True,
        "message": "Folder and all its contents deleted successfully"
    }

@router.get("/{id}/download")
def download_folder(
    id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    zip_path, zip_filename = folder_service.create_folder_zip(db, id, current_user)
    background_tasks.add_task(folder_service.cleanup_temp_file, zip_path)
    return FastAPIFileResponse(
        path=zip_path,
        filename=zip_filename,
        media_type="application/zip"
    )

