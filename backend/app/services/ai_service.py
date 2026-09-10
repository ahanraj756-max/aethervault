import os
import json
import re
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session

from backend.app.models.file import File
from backend.app.models.folder import Folder
from backend.app.models.ai_metadata import AIMetadata
from backend.app.config import settings
from backend.app.utils.file_utils import get_file_category

# =====================================================================
# AI PROVIDER INTERFACES AND IMPLEMENTATIONS
# =====================================================================

class AIProvider(ABC):
    @abstractmethod
    def generate_metadata(self, text: str, filename: str) -> dict:
        """Return dict with 'summary', 'keywords' (list), and 'tags' (list)."""
        pass

    @abstractmethod
    def smart_search(self, query: str, user_files_metadata: list[dict]) -> list[dict]:
        """Rank user files by relevance to the query. Returns list of dicts with match details."""
        pass

    @abstractmethod
    def chat_with_docs(self, query: str, context_documents: list[dict]) -> dict:
        """Answer queries using retrieved content context. Returns dict with 'answer' and 'sources'."""
        pass

    @abstractmethod
    def suggest_organization(self, files: list[dict], folders: list[dict]) -> list[dict]:
        """Suggest logical folder mapping proposals for files."""
        pass


class LocalAIProvider(AIProvider):
    """Offline NLP provider using keyword metrics, rules, and text structures."""
    
    def generate_metadata(self, text: str, filename: str) -> dict:
        # 1. Generate local summary
        if not text:
            summary = f"No text content extractable from '{filename}'."
            keywords = []
            tags = ["#file"]
        else:
            clean_text = re.sub(r'\s+', ' ', text).strip()
            summary = clean_text[:250] + ("..." if len(clean_text) > 250 else "")
            
            # 2. Extract keywords by frequency (excluding simple stopwords)
            words = re.findall(r'\b[a-zA-Z]{4,15}\b', clean_text.lower())
            stopwords = {"with", "your", "that", "this", "from", "they", "then", "have", "were", "what", 
                         "about", "their", "there", "would", "could", "should", "other", "these", "about"}
            filtered_words = [w for w in words if w not in stopwords]
            
            # Count frequencies
            freqs = {}
            for w in filtered_words:
                freqs[w] = freqs.get(w, 0) + 1
            sorted_words = sorted(freqs.items(), key=lambda x: x[1], reverse=True)
            keywords = [w[0] for w in sorted_words[:8]]
            
            # 3. Generate tags
            tags = [f"#{kw}" for kw in keywords[:3]]
            if not tags:
                tags = ["#document"]
                
        return {
            "summary": summary,
            "keywords": keywords,
            "tags": tags
        }

    def smart_search(self, query: str, user_files_metadata: list[dict]) -> list[dict]:
        query_words = set(re.findall(r'\b\w+\b', query.lower()))
        results = []
        
        for item in user_files_metadata:
            file_record = item["file"]
            meta = item.get("meta") or {}
            
            score = 0.0
            reasons = []
            
            original_filename = file_record.original_filename.lower()
            indexed_content = (meta.get("indexed_content") or "").lower()
            summary = (meta.get("summary") or "").lower()
            keywords = [k.lower() for k in (meta.get("keywords") or [])]
            tags = [t.lower() for t in (meta.get("tags") or [])]
            
            # Match 1: Exact query in filename
            if query.lower() in original_filename:
                score += 1.0
                reasons.append("filename_match")
            # Match 2: Query words in filename
            elif any(w in original_filename for w in query_words):
                score += 0.6
                reasons.append("filename_partial")
                
            # Match 3: Query words in tags/keywords
            matching_tags = [t for t in tags if any(qw in t for qw in query_words)]
            matching_kws = [k for k in keywords if any(qw in k for qw in query_words)]
            if matching_tags or matching_kws:
                score += 0.5
                reasons.append("tags_match")
                
            # Match 4: Query words in summary/content
            if indexed_content and any(w in indexed_content for w in query_words):
                score += 0.3
                reasons.append("content_match")
                
            if score > 0:
                # Classify match type
                if "filename_match" in reasons:
                    match_type = "exact"
                elif "tags_match" in reasons or "filename_partial" in reasons:
                    match_type = "semantic"
                else:
                    match_type = "suggested"
                    
                results.append({
                    "file": file_record,
                    "match_type": match_type,
                    "relevance_score": round(score, 2)
                })
                
        # Sort by score desc
        return sorted(results, key=lambda x: x["relevance_score"], reverse=True)

    def chat_with_docs(self, query: str, context_documents: list[dict]) -> dict:
        query_words = set(re.findall(r'\b\w+\b', query.lower()))
        matching_snippets = []
        used_files = []
        
        for doc in context_documents:
            filename = doc["filename"]
            content = doc["content"]
            file_obj = doc["file_obj"]
            
            if not content:
                continue
                
            # Search paragraph-by-paragraph or sentence-by-sentence
            paragraphs = content.split('\n')
            file_snippets = []
            
            for para in paragraphs:
                para_clean = para.strip()
                if not para_clean or len(para_clean) < 15:
                    continue
                # If paragraph contains query words, extract it
                if any(w in para_clean.lower() for w in query_words):
                    file_snippets.append(para_clean)
                    
            if file_snippets:
                snippet_text = "\n".join(file_snippets[:2])
                matching_snippets.append(f"From file '{filename}':\n... {snippet_text} ...")
                used_files.append(file_obj)
                
        if matching_snippets:
            answer = (
                "Here is what I found in your files related to your question:\n\n" +
                "\n\n".join(matching_snippets)
            )
        else:
            answer = (
                f"I searched through your indexed files for terms relating to '{query}', "
                "but couldn't find any direct matches. Please make sure the files containing "
                "this topic are uploaded and successfully processed."
            )
            
        return {
            "answer": answer,
            "sources": used_files
        }

    def suggest_organization(self, files: list[dict], folders: list[dict]) -> list[dict]:
        proposals = []
        
        # Build map of existing folders by name
        folder_map = {f["name"].lower(): f["id"] for f in folders}
        
        for file in files:
            # Files already organized in a folder or uploaded into a folder should not be reorganized
            if file.get("folder_id") is not None:
                continue

            fname = file["original_filename"]
            fid = file["id"]
            current_folder_id = file.get("folder_id")
            current_folder_name = file.get("folder_name", "Root")
            ext = os.path.splitext(fname)[1].lower()
            
            # Simple extension-based proposal mapping
            category = get_file_category(ext)
            suggested_name = "Other"
            
            if category == 'document':
                suggested_name = "Documents"
            elif category == 'image':
                suggested_name = "Photos"
            elif category == 'video':
                suggested_name = "Videos"
            elif category == 'audio':
                suggested_name = "Audio"
            elif category == 'archive':
                suggested_name = "Archives"
                
            # If the file is already in a folder with this name, don't propose a change
            if current_folder_name.lower() == suggested_name.lower():
                continue
                
            suggested_id = folder_map.get(suggested_name.lower())
            
            proposals.append({
                "file_id": fid,
                "original_filename": fname,
                "current_folder_id": current_folder_id,
                "current_folder_name": current_folder_name,
                "suggested_folder_name": suggested_name,
                "suggested_folder_id": suggested_id
            })
            
        return proposals


class GeminiAIProvider(AIProvider):
    """Cloud AI provider utilizing Gemini APIs."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Lazy load client to avoid crashing if library is missing
        from google import genai
        self.client = genai.Client(api_key=api_key)

    def generate_metadata(self, text: str, filename: str) -> dict:
        if not text:
            return {"summary": "Empty file.", "keywords": [], "tags": ["#empty"]}
            
        prompt = (
            "Analyze the following document content and return a JSON structure with keys: "
            "'summary' (a concise 2-sentence summary), 'keywords' (list of up to 6 single-word keywords in lowercase), "
            "and 'tags' (list of up to 3 hashtags like '#notes').\n"
            f"Filename: {filename}\n"
            f"Content: {text[:6000]}\n"
        )
        
        try:
            # Request JSON output structure
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            data = json.loads(response.text)
            raw_keywords = data.get("keywords", [])
            clean_keywords = [str(k).strip().lower() for k in raw_keywords if str(k).strip()]
            raw_tags = data.get("tags", [])
            clean_tags = [str(t).strip() for t in raw_tags if str(t).strip()]
            return {
                "summary": data.get("summary", ""),
                "keywords": clean_keywords,
                "tags": clean_tags
            }
        except Exception as e:
            # Fall back to local parsing on failure
            fallback = LocalAIProvider()
            return fallback.generate_metadata(text, filename)

    def smart_search(self, query: str, user_files_metadata: list[dict]) -> list[dict]:
        # Formulate query matching using LLM semantic evaluation
        # To avoid sending too many requests, we send metadata of files to Gemini
        # and ask it to rank and score their relevance to the user's query
        if not user_files_metadata:
            return []
            
        files_summary = []
        for item in user_files_metadata:
            file_rec = item["file"]
            meta = item.get("meta") or {}
            files_summary.append({
                "id": file_rec.id,
                "filename": file_rec.original_filename,
                "summary": meta.get("summary", ""),
                "keywords": meta.get("keywords", []),
                "tags": meta.get("tags", [])
            })
            
        prompt = (
            "Given the user's search query, evaluate the relevance of each file. "
            "For each file, determine if it is a match. Classify 'match_type' as 'exact' "
            "(if query matches the file meaning perfectly), 'semantic' (if content matches topic), "
            "or 'suggested' (if it is a potential match). Provide a score between 0.0 and 1.0.\n"
            "Return a JSON object containing a key 'results' which maps to an array of objects: "
            "{'id': integer, 'match_type': string, 'score': float}.\n"
            f"Query: {query}\n"
            f"Files Metadata: {json.dumps(files_summary)}\n"
        )
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            raw_results = json.loads(response.text).get("results", [])
            
            # Map back to File records
            file_map = {item["file"].id: item["file"] for item in user_files_metadata}
            results = []
            for r in raw_results:
                fid = r.get("id")
                score = r.get("score", 0.0)
                if fid in file_map and score > 0.1:
                    results.append({
                        "file": file_map[fid],
                        "match_type": r.get("match_type", "suggested"),
                        "relevance_score": score
                    })
            return sorted(results, key=lambda x: x["relevance_score"], reverse=True)
        except Exception:
            fallback = LocalAIProvider()
            return fallback.smart_search(query, user_files_metadata)

    def chat_with_docs(self, query: str, context_documents: list[dict]) -> dict:
        if not context_documents:
            return {
                "answer": "No files found to search context from. Please upload files containing topics related to your question.",
                "sources": []
            }
            
        doc_contexts = []
        for doc in context_documents:
            doc_contexts.append(
                f"Source File: {doc['filename']}\n"
                f"Content Summary: {doc.get('summary', '')}\n"
                f"Content Body: {doc['content'][:4000]}\n"
            )
            
        prompt = (
            "You are AetherVault AI, a secure files assistant. "
            "Using the source document contexts below, answer the user's question. "
            "Keep the answer concise and clear. Proactively list which filenames you used to extract this answer. "
            "If the documents do not contain the answer, say that you cannot find the details in the documents.\n\n"
            f"Context Documents:\n{'='*40}\n" + "\n\n".join(doc_contexts) + f"\n{'='*40}\n"
            f"User Question: {query}\n"
        )
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            # Find which files are mentioned or select all docs that had text
            sources = [doc["file_obj"] for doc in context_documents if doc["content"]]
            return {
                "answer": response.text,
                "sources": sources
            }
        except Exception as e:
            fallback = LocalAIProvider()
            return fallback.chat_with_docs(query, context_documents)

    def suggest_organization(self, files: list[dict], folders: list[dict]) -> list[dict]:
        # Filter to only unorganized root files (files in folders are already organized)
        root_files = [f for f in files if f.get("folder_id") is None]
        if not root_files:
            return []
            
        prompt = (
            "Analyze these unorganized files located in the root directory and available folders. "
            "Propose a smart classification reorganization plan for these root files only. "
            "For each file, suggest moving it into an existing folder name or suggest a new folder name to create. "
            "Return a JSON array of objects: "
            "[{'file_id': int, 'original_filename': string, 'current_folder_name': string, 'suggested_folder_name': string, 'suggested_folder_id': int_or_null}].\n"
            f"Files to organize: {json.dumps(root_files)}\n"
            f"Existing Folders: {json.dumps(folders)}\n"
        )
        
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config={"response_mime_type": "application/json"}
            )
            return json.loads(response.text)
        except Exception:
            fallback = LocalAIProvider()
            return fallback.suggest_organization(root_files, folders)


# =====================================================================
# SERVICE FUNCTIONS AND BACKGROUND TASK HANDLER
# =====================================================================

def get_ai_provider() -> AIProvider:
    if settings.AI_ENABLED and settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        try:
            return GeminiAIProvider(settings.GEMINI_API_KEY)
        except Exception:
            pass
    return LocalAIProvider()

def extract_file_text_locally(file_path: str, extension: str) -> str:
    ext = extension.lower()
    text = ""
    if not os.path.exists(file_path):
        return ""
        
    if ext in ('.txt', '.md', '.json', '.csv', '.xml', '.html'):
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception:
            pass
    elif ext == '.pdf':
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            pages = []
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    pages.append(extracted)
            text = "\n".join(pages)
        except Exception as e:
            text = f"[Local PDF Extraction Failure: {str(e)}]"
    elif ext == '.docx':
        try:
            import docx
            doc = docx.Document(file_path)
            paragraphs = [p.text for p in doc.paragraphs]
            text = "\n".join(paragraphs)
        except Exception as e:
            text = f"[Local DOCX Extraction Failure: {str(e)}]"
            
    return text.strip()

def process_document(db: Session, file_id: int) -> None:
    """Process text extraction and metadata indexing using the provided session."""
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        return
        
    ai_meta = db.query(AIMetadata).filter(AIMetadata.file_id == file_id).first()
    if not ai_meta:
        ai_meta = AIMetadata(file_id=file_id)
        db.add(ai_meta)
        
    ai_meta.processing_status = "processing"
    db.commit()
    
    try:
        user_dir = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{db_file.user_id}"))
        physical_path = os.path.join(user_dir, db_file.relative_path)
        
        # 1. Extract raw text
        text = extract_file_text_locally(physical_path, db_file.extension)
        ai_meta.indexed_content = text
        
        # 2. Query Active AI Provider for summaries and tags
        provider = get_ai_provider()
        metadata = provider.generate_metadata(text, db_file.original_filename)
        
        ai_meta.summary = metadata.get("summary", "")
        # Save as comma-separated or JSON
        ai_meta.keywords = ",".join(metadata.get("keywords", []))
        ai_meta.tags = ",".join(metadata.get("tags", []))
        ai_meta.processing_status = "completed"
        
    except Exception as e:
        ai_meta.processing_status = "failed"
        ai_meta.summary = f"Error processing file metadata: {str(e)}"
        
    db.add(ai_meta)
    db.commit()

def process_document_task(file_id: int) -> None:
    """Safe background task runner that manages its own database session."""
    from backend.app.database import SessionLocal
    db = SessionLocal()
    try:
        process_document(db, file_id)
    finally:
        db.close()

