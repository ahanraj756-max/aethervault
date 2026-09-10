from pydantic import BaseModel
from typing import List, Optional
from backend.app.schemas.files import FileResponse

class AISearchRequest(BaseModel):
    query: str

class AISearchResultItem(BaseModel):
    file: FileResponse
    match_type: str # exact, semantic, suggested
    relevance_score: float

class AISummarizeResponse(BaseModel):
    summary: str
    keywords: List[str]
    tags: List[str]

class AIChatRequest(BaseModel):
    query: str

class AIChatResponse(BaseModel):
    answer: str
    sources: List[FileResponse]

class AIOrganizationProposalItem(BaseModel):
    file_id: int
    original_filename: str
    current_folder_id: Optional[int]
    current_folder_name: str
    suggested_folder_name: str
    suggested_folder_id: Optional[int]

class AIOrganizeExecuteItem(BaseModel):
    file_id: int
    suggested_folder_name: str
    suggested_folder_id: Optional[int]

class AIOrganizeExecuteRequest(BaseModel):
    actions: List[AIOrganizeExecuteItem]

class DuplicateGroup(BaseModel):
    file_hash: str
    file_size: int
    locations: List[FileResponse]
    num_duplicates: int
