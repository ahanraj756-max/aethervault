from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class FileRename(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class FileMove(BaseModel):
    folder_id: int | None = None

class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    folder_id: int | None
    original_filename: str
    stored_filename: str
    relative_path: str
    mime_type: str
    extension: str
    file_size: int
    file_hash: str
    is_favorite: bool
    is_trashed: bool = False
    trashed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
