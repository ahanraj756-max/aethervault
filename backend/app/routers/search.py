from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
import datetime
from typing import Optional

from backend.app.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.schemas.files import FileResponse
from backend.app.services import search_service

router = APIRouter()

@router.get("", response_model=dict)
def search(
    query: Optional[str] = None,
    category: Optional[str] = None,
    extension: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    size_category: Optional[str] = None,
    date_filter: Optional[str] = None,
    start_date: Optional[datetime.datetime] = None,
    end_date: Optional[datetime.datetime] = None,
    folder_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    files = search_service.search_files(
        db=db,
        user=current_user,
        query=query,
        category=category,
        extension=extension,
        is_favorite=is_favorite,
        size_category=size_category,
        date_filter=date_filter,
        start_date=start_date,
        end_date=end_date,
        folder_id=folder_id
    )
    return {
        "success": True,
        "data": [FileResponse.model_validate(f) for f in files]
    }
