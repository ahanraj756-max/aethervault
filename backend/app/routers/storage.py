from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.storage import StorageStats
from backend.app.schemas.files import FileResponse
from backend.app.services import storage_service

router = APIRouter()

@router.get("/stats", response_model=dict)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stats = storage_service.get_storage_stats(db, current_user)
    return {
        "success": True,
        "data": StorageStats.model_validate(stats)
    }

@router.get("/largest-files", response_model=dict)
def get_largest_files(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = storage_service.get_largest_files(db, current_user, limit)
    return {
        "success": True,
        "data": [FileResponse.model_validate(f) for f in files]
    }

@router.get("/recent", response_model=dict)
def get_recent(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = storage_service.get_recent_files(db, current_user, limit)
    return {
        "success": True,
        "data": [FileResponse.model_validate(f) for f in files]
    }
