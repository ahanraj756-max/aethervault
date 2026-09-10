# Environment Configuration and Startup Guide - AetherVault

This document explains configuration settings and launch commands for local environments.

---

## Environment Variables (.env) Reference

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `APP_NAME` | `AetherVault` | The application name. |
| `ENVIRONMENT` | `development` | Development or Production flag. |
| `DATABASE_URL` | `sqlite:///./app.db` | Connection string (supports SQLite or PostgreSQL). |
| `SECRET_KEY` | *(change in prod)* | JWT token signature secret string. |
| `STORAGE_ROOT` | `./storage` | The folder where physical files are sandboxed. |
| `MAX_UPLOAD_SIZE_MB` | `500` | Limits size of individual file uploads. |
| `DEFAULT_STORAGE_QUOTA_GB` | `10` | Default quota in GB assigned to new accounts. |
| `AI_ENABLED` | `true` | Set to true to index metadata and extract content text. |
| `AI_PROVIDER` | `local` | `local` (offline mock heuristics) or `gemini` (cloud LLM). |
| `GEMINI_API_KEY` | *(optional)* | Required if `AI_PROVIDER` is set to `gemini`. |

---

## Detailed Step-by-Step Launch

### 1. Initialize Backend
From the workspace root directory:
```powershell
# Create venv
python -m venv venv

# Activate venv
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r backend/requirements.txt

# Start backend dev server
python run.py
```
*Verify: Open browser to `http://localhost:8000/docs` to see API Swagger dashboard.*

### 2. Initialize Frontend
From the `frontend/` directory:
```powershell
# Install Node.js modules
npm install

# Start Vite React server
npm run dev
```
*Verify: Open browser to `http://localhost:5173` to access the login page.*
