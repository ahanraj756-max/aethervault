from pydantic import BaseModel
from typing import List
from backend.app.schemas.files import FileResponse
from backend.app.schemas.folders import FolderResponse

class TrashContentsResponse(BaseModel):
    files: List[FileResponse]
    folders: List[FolderResponse]
    total_items: int
    total_size: int # in bytes
