from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: int | None = None

class FolderUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)

class FolderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    parent_id: int | None
    is_trashed: bool = False
    trashed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
