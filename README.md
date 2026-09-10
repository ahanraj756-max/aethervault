# AetherVault
## AI-Powered Personal Cloud Storage & Intelligent File Assistant

**AetherVault** is a private, self-hosted, AI-powered cloud storage platform that turns your local laptop or PC into a secure personal server. CONCEPTUALLY similar to Google Drive or Dropbox, AetherVault distinguishes itself with a vital privacy tenet: **your files remain stored within a dedicated local storage sandbox directory**, completely isolated from arbitrary system access, and never uploaded to third-party public clouds without consent.

---

## Key Features

- **Private Workspace Sandbox:** Complete filesystem isolation prevents path traversal attacks. Your files belong to you.
- **Relational Directory Trees:** Virtual nested folder hierarchy inside SQLite allows file and folder moves in O(1) time without slow physical file reshuffling.
- **Robust Multi-Upload Portal:** Drag-and-drop file upload, multiple upload streaming, and automatic filename collision resolution (e.g. `file (1).txt`).
- **Disk Quotas & Storage Analytics:** Displays space breakdown by type clusters (Documents, Images, Audio, Videos, Archives) and lists largest/recent files.
- **SHA-256 Duplicates Cleaner:** Detects duplicates based on cryptographic signatures and allows selective cleaning.
- **Local/Cloud AI Service Layer:** 
  - **Local/Offline AI:** Local text extractor (for `.txt`, `.md`, `.pdf`, `.docx`) combined with keyword frequency heuristics for summaries and local search.
  - **Gemini AI Integration:** Cloud generation support for advanced semantic queries, context RAG answers, and class organization recommendations using the Google GenAI SDK.
- **Premium Glassmorphic Theme:** Dark/Light themes built on custom CSS variables, with hover animations and collapsible drawers.

---

## System Requirements

- **Operating System:** Windows 10/11 (or macOS / Linux)
- **Runtime Environment:** Python 3.11+
- **Javascript Engine:** Node.js 20+ and `npm`

---

## Windows Installation Guide

### Step 1: Download / Clone Project
Extract the AetherVault code package to a folder on your Windows computer (e.g., `C:\Users\YourUser\Desktop\AetherVault`).

### Step 2: Configure Environment Settings
Copy the `.env.example` to `.env` in the root workspace directory. If you wish to use Gemini AI features, configure your API key:
```env
AI_ENABLED=true
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key
```
If `GEMINI_API_KEY` is omitted, the application will degrade gracefully to the built-in offline **LocalAIProvider** (free and offline).

### Step 3: Setup Python Backend Environment
Open PowerShell inside the workspace directory and execute:
```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r backend/requirements.txt
```

### Step 4: Setup Node.js Frontend environment
Open a second PowerShell window, navigate to the `frontend` folder and run:
```powershell
npm install
```

---

## Running AetherVault

### Run Python Backend Server
Activate the virtual environment and run the universal `run.py` startup file from the workspace root:
```powershell
.\venv\Scripts\Activate.ps1
python run.py
```
The FastAPI backend server starts at `http://localhost:8000`. You can inspect the interactive OpenAPI specifications at `http://localhost:8000/docs`.

### Run React Frontend Dev Server
Navigate to the `frontend` directory and boot the Vite development server:
```powershell
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## Security Safeguards Review

1. **Anti Path Traversal Isolation:** All files are physically stored as `storage/users/user_<user_id>/files/<uuid>`. Since files are referenced by server-generated UUIDs, users cannot inject path sequences like `../../etc/passwd` to read host files.
2. **Strict Folder Sandbox Verification:** Every operation (download, rename, move, delete) queries folder parent ownership (`folder.user_id == current_user.id`) prior to database updates.
3. **Secure Password Storage:** Passwords are hashed using the modern `bcrypt` key derivation function.

---

## Troubleshooting common issues

### 1. Port 8000 or 5173 is already in use
If another application is running on port 8000 or 5173:
- For the backend: Open `run.py` and modify the port parameter (e.g. `port=8080`), and update `BASE_URL` in `frontend/src/utils/api.ts` accordingly.
- For the frontend: Vite will automatically suggest a fallback port like `5174`.

### 2. SQLite Database locks or database errors
If the SQLite file database gets corrupted, you can safely delete the local `app.db` file. The database and tables will be recreated from scratch on the next server startup.

### 3. File Permissions / Upload errors
Ensure the account running python has read/write permissions for the `STORAGE_ROOT` directory defined in your `.env` configuration file (default is `./storage`).
