# System Architecture - AetherVault

This document reviews the architectural layout, modules, database structures, and background task workers of AetherVault.

---

## Technical Block Diagram

```text
  [ User Client UI ] <--- (React Router / API Client) ---> [ Vite Dev Server (5173) ]
         |
     HTTP Requests (with JWT access token)
         v
  [ FastAPI Gateway (8000) ]
         |
         +--> CORS Middleware (allow cross-origin requests from React)
         |
         +--> Auth Dependency Check (decode JWT, check User status)
         |
         +--> Route Handlers (routers/auth.py, files.py, folders.py, etc.)
               |
               +--> Services Business Logic (services/file_service.py, etc.)
                     |
                     +--> Database Session (SQLAlchemy SQLite ORM)
                     |
                     +--> AI Subsystem Interface (AIProvider / Local / Gemini)
                     |
                     +--> Background Task Executor (asynchronous text indexing)
```

---

## Modularity & File Separation

AetherVault is strictly divided into three layers to support scalability:

1. **Routing Layer (`routers/`):** Handles HTTP route definitions, input schema parsing (Pydantic), exception mappings, and endpoint response envelopes.
2. **Business Logic Layer (`services/`):** Executes storage quota computations, hash duplications checking, folder cycles checks, and AI classification recommendations.
3. **Data Access Layer (`models/`):** Manages SQLite entities mapping users, virtual folder nodes, file metadata pointers, and logging logs.

---

## Asynchronous Background Worker

Expensive file text extraction (especially parsing PDFs/docx) and semantic summarization calls occur asynchronously outside client request loops using FastAPI's `BackgroundTasks` library. 
- During upload, files are saved immediately. The file's AI status is marked as `pending`.
- A background worker thread is spawned: `process_document(db, file_id)`.
- The worker updates status to `processing`, extracts raw text locally, sends contents to the active AI provider, updates summary metadata, indexes text search keywords, and marks the status as `completed`.
- If parsing fails, status is marked as `failed`, allowing graceful UI degradation.
