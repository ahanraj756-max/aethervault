from fastapi import APIRouter, Depends, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User
from backend.app.models.file import File
from backend.app.models.folder import Folder
from backend.app.models.ai_metadata import AIMetadata
from backend.app.schemas.ai import (
    AISearchRequest, AISearchResultItem, AISummarizeResponse,
    AIChatRequest, AIChatResponse, AIOrganizationProposalItem,
    AIOrganizeExecuteRequest, DuplicateGroup
)
from backend.app.schemas.files import FileResponse
from backend.app.services import ai_service, duplicate_service, file_service, folder_service

router = APIRouter()

@router.post("/search", response_model=dict)
def ai_search(
    data: AISearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch all user files and their AI metadata
    files = db.query(File).filter(File.user_id == current_user.id, File.is_trashed == False).all()
    
    files_metadata = []
    for f in files:
        meta_rec = db.query(AIMetadata).filter(AIMetadata.file_id == f.id).first()
        meta_dict = {}
        if meta_rec:
            meta_dict = {
                "summary": meta_rec.summary or "",
                "keywords": (meta_rec.keywords or "").split(",") if meta_rec.keywords else [],
                "tags": (meta_rec.tags or "").split(",") if meta_rec.tags else [],
                "indexed_content": meta_rec.indexed_content or ""
            }
        files_metadata.append({
            "file": f,
            "meta": meta_dict
        })
        
    provider = ai_service.get_ai_provider()
    results = provider.smart_search(data.query, files_metadata)
    
    # Map to schema response
    formatted_results = []
    for r in results:
        formatted_results.append(
            AISearchResultItem(
                file=FileResponse.model_validate(r["file"]),
                match_type=r["match_type"],
                relevance_score=r["relevance_score"]
            )
        )
        
    return {
        "success": True,
        "data": formatted_results
    }

@router.post("/summarize/{file_id}", response_model=dict)
def get_summary(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify file ownership (checks is_trashed == False)
    db_file = file_service.get_file_by_id(db, file_id, current_user)
    
    ai_meta = db.query(AIMetadata).filter(AIMetadata.file_id == file_id).first()
    
    # If not completed, trigger local text extraction and run processing inline
    if not ai_meta or ai_meta.processing_status != "completed":
        ai_service.process_document(db, file_id)
        ai_meta = db.query(AIMetadata).filter(AIMetadata.file_id == file_id).first()
        
    keywords_list = (ai_meta.keywords or "").split(",") if ai_meta.keywords else []
    tags_list = (ai_meta.tags or "").split(",") if ai_meta.tags else []
    
    return {
        "success": True,
        "data": AISummarizeResponse(
            summary=ai_meta.summary or "Summary not available.",
            keywords=[k.strip() for k in keywords_list if k.strip()],
            tags=[t.strip() for t in tags_list if t.strip()]
        )
    }

@router.post("/chat", response_model=dict)
def chat_with_files(
    data: AIChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Search for files relevant to the query to serve as context (RAG)
    files = db.query(File).filter(File.user_id == current_user.id, File.is_trashed == False).all()
    
    files_metadata = []
    for f in files:
        meta_rec = db.query(AIMetadata).filter(AIMetadata.file_id == f.id).first()
        if meta_rec and meta_rec.indexed_content:
            files_metadata.append({
                "file": f,
                "meta": {
                    "summary": meta_rec.summary or "",
                    "keywords": (meta_rec.keywords or "").split(",") if meta_rec.keywords else [],
                    "tags": (meta_rec.tags or "").split(",") if meta_rec.tags else [],
                    "indexed_content": meta_rec.indexed_content or ""
                }
            })
            
    # Rank by search relevance locally first to select top context docs
    provider = ai_service.get_ai_provider()
    search_results = provider.smart_search(data.query, files_metadata)
    
    # Take top 5 most relevant documents
    top_results = search_results[:5]
    context_docs = []
    for r in top_results:
        f = r["file"]
        # Find raw content in meta list
        f_meta = next(item for item in files_metadata if item["file"].id == f.id)
        context_docs.append({
            "filename": f.original_filename,
            "content": f_meta["meta"]["indexed_content"],
            "summary": f_meta["meta"]["summary"],
            "file_obj": f
        })
        
    chat_response = provider.chat_with_docs(data.query, context_docs)
    
    return {
        "success": True,
        "data": AIChatResponse(
            answer=chat_response["answer"],
            sources=[FileResponse.model_validate(s) for s in chat_response["sources"]]
        )
    }

@router.get("/organize/propose", response_model=dict)
def propose_organization(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only retrieve unorganized files currently in the root directory (folder_id=None).
    # Files already uploaded into or assigned to a folder should not be suggested for reorganization.
    files = db.query(File).filter(
        File.user_id == current_user.id,
        File.is_trashed == False,
        File.folder_id.is_(None)
    ).all()
    folders = db.query(Folder).filter(Folder.user_id == current_user.id, Folder.is_trashed == False).all()
    
    files_list = []
    for f in files:
        files_list.append({
            "id": f.id,
            "original_filename": f.original_filename,
            "folder_id": None,
            "folder_name": "Root"
        })
        
    folders_list = [{"id": fold.id, "name": fold.name} for fold in folders]
    
    provider = ai_service.get_ai_provider()
    proposals = provider.suggest_organization(files_list, folders_list)
    
    # Map to schema validation
    validated = []
    for p in proposals:
        validated.append(
            AIOrganizationProposalItem(
                file_id=p["file_id"],
                original_filename=p["original_filename"],
                current_folder_id=p.get("current_folder_id", None),
                current_folder_name=p.get("current_folder_name", "Root"),
                suggested_folder_name=p["suggested_folder_name"],
                suggested_folder_id=p["suggested_folder_id"]
            )
        )
        
    return {
        "success": True,
        "data": validated
    }

@router.post("/organize/execute", response_model=dict)
def execute_organization(
    data: AIOrganizeExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Track dynamically created folders to avoid duplicates
    created_folders = {} # name -> folder_id
    
    applied = 0
    for action in data.actions:
        fid = action.file_id
        folder_id = action.suggested_folder_id
        folder_name = action.suggested_folder_name
        
        try:
            # If folder_id not provided but name matches a folder created in this loop
            if folder_id is None and folder_name.lower() in created_folders:
                folder_id = created_folders[folder_name.lower()]
            # If folder_id not provided and folder doesn't exist, create it!
            elif folder_id is None:
                # Check if folder name already exists in database
                exist_fold = db.query(Folder).filter(
                    Folder.user_id == current_user.id,
                    Folder.parent_id == None,
                    Folder.name.ilike(folder_name)
                ).first()
                
                if exist_fold:
                    folder_id = exist_fold.id
                else:
                    new_folder = folder_service.create_folder(
                        db=db,
                        data=folder_service.FolderCreate(name=folder_name, parent_id=None),
                        user=current_user
                    )
                    folder_id = new_folder.id
                    created_folders[folder_name.lower()] = folder_id
                    
            file_service.move_file(db, fid, folder_id, current_user)
            applied += 1
        except Exception:
            # Skip any failing items silently to ensure completion of others
            pass
            
    return {
        "success": True,
        "message": f"Successfully moved {applied} files to target folders"
    }

@router.get("/duplicates", response_model=dict)
def scan_duplicates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    duplicates = duplicate_service.get_duplicate_files(db, current_user)
    
    # Map to schema validation
    formatted = []
    for g in duplicates:
        formatted.append(
            DuplicateGroup(
                file_hash=g["file_hash"],
                file_size=g["file_size"],
                locations=[FileResponse.model_validate(loc) for loc in g["locations"]],
                num_duplicates=g["num_duplicates"]
            )
        )
        
    return {
        "success": True,
        "data": formatted
    }
