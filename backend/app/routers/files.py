from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, status
from fastapi.responses import FileResponse as FastAPIFileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.files import FileResponse, FileRename, FileMove
from backend.app.services import file_service
# We will import the AI background processing service later
from backend.app.services import ai_service

router = APIRouter()

@router.post("/upload")
async def upload_files(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    uploaded_records = []
    errors = []
    
    for file in files:
        try:
            db_file = await file_service.upload_file(db, current_user, file, folder_id)
            uploaded_records.append(FileResponse.model_validate(db_file))
            
            # Queue background task for AI document intelligence indexing
            if settings_ai_enabled():
                background_tasks.add_task(ai_service.process_document_task, db_file.id)
                
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })
            
    if errors and not uploaded_records:
        return {
            "success": False,
            "message": "All uploads failed",
            "errors": errors
        }
        
    return {
        "success": True,
        "message": f"Successfully uploaded {len(uploaded_records)} files" + (f" ({len(errors)} failed)" if errors else ""),
        "data": {
            "uploaded": uploaded_records,
            "failed": errors
        }
    }

from backend.app.models.file import File as DBFile

@router.get("", response_model=dict)
def list_files(
    folder_id: Optional[int] = None,
    favorite: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(DBFile).filter(DBFile.user_id == current_user.id)
    
    if folder_id is not None:
        query = query.filter(DBFile.folder_id == folder_id)
    
    if favorite is not None:
        query = query.filter(DBFile.is_favorite == favorite)
        
    files = query.order_by(DBFile.created_at.desc()).all()
    return {
        "success": True,
        "data": [FileResponse.model_validate(f) for f in files]
    }

@router.get("/{id}", response_model=dict)
def get_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = file_service.get_file_by_id(db, id, current_user)
    return {
        "success": True,
        "data": FileResponse.model_validate(db_file)
    }

@router.get("/{id}/download")
def download_file(
    id: int,
    inline: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = file_service.get_file_by_id(db, id, current_user)
    file_path, filename = file_service.get_file_download_path(db, id, current_user)
    if inline:
        return FastAPIFileResponse(
            path=file_path,
            media_type=db_file.mime_type or "application/octet-stream",
            content_disposition_type="inline"
        )
    # Stream download directly
    return FastAPIFileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )

@router.put("/{id}/rename")
def rename_file(
    id: int,
    data: FileRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = file_service.rename_file(db, id, data.name, current_user)
    return {
        "success": True,
        "message": "File renamed successfully",
        "data": FileResponse.model_validate(db_file)
    }

@router.put("/{id}/move")
def move_file(
    id: int,
    data: FileMove,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = file_service.move_file(db, id, data.folder_id, current_user)
    return {
        "success": True,
        "message": "File moved successfully",
        "data": FileResponse.model_validate(db_file)
    }

@router.post("/{id}/copy")
def copy_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_copy = file_service.copy_file(db, id, current_user)
    return {
        "success": True,
        "message": "File duplicated successfully",
        "data": FileResponse.model_validate(db_copy)
    }

@router.post("/{id}/favorite")
def toggle_favorite(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_file = file_service.toggle_favorite(db, id, current_user)
    return {
        "success": True,
        "message": "Favorite status updated",
        "data": FileResponse.model_validate(db_file)
    }

@router.delete("/{id}")
def delete_file(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    file_service.delete_file(db, id, current_user)
    return {
        "success": True,
        "message": "File deleted successfully"
    }

# Helper references to avoid circular imports during early loads
def models_File():
    from backend.app.models.file import File
    return File

def settings_ai_enabled():
    from backend.app.config import settings
    return settings.AI_ENABLED
