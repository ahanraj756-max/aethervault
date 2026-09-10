import os
import sys
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from backend.app.config import settings
from backend.app.database import engine, Base, run_migrations
from backend.app import models
from backend.app.core.exceptions import AetherVaultException
from backend.app.core.logging import setup_logging

# Setup structured logger
setup_logging()

# Initialize Database tables and schema migrations
Base.metadata.create_all(bind=engine)
run_migrations(engine)

app = FastAPI(
    title=settings.APP_NAME,
    description="AetherVault: AI-Powered Personal Cloud Storage & File Assistant",
    version="1.0.0"
)

# Enable CORS for frontend API calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, lock this down to the specific UI domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers mapping to standard API responses
@app.exception_handler(AetherVaultException)
async def aethervault_exception_handler(request: Request, exc: AetherVaultException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "error_code": exc.error_code
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    msg = "Validation error"
    if errors:
        loc = errors[0].get('loc')
        field_name = loc[-1] if loc else "field"
        msg = f"Invalid input for {field_name}: {errors[0].get('msg')}"
    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "message": msg,
            "error_code": "VALIDATION_ERROR"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc) or "An unexpected internal server error occurred",
            "error_code": "INTERNAL_SERVER_ERROR"
        }
    )

# Import and include Routers
from backend.app.routers import auth, files, folders, storage, search, ai, trash

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(files.router, prefix="/api/v1/files", tags=["Files"])
app.include_router(folders.router, prefix="/api/v1/folders", tags=["Folders"])
app.include_router(storage.router, prefix="/api/v1/storage", tags=["Storage Stats"])
app.include_router(search.router, prefix="/api/v1/search", tags=["Search"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Features"])
app.include_router(trash.router, prefix="/api/v1/trash", tags=["Recycle Bin"])


def _get_frontend_dist() -> str | None:
    """Resolve the frontend dist folder — works both from source and as a PyInstaller exe."""
    if getattr(sys, "frozen", False):
        # PyInstaller unpacks everything to sys._MEIPASS
        path = os.path.join(sys._MEIPASS, "frontend_dist")  # type: ignore[attr-defined]
    else:
        path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
        )
    return path if os.path.isdir(path) else None


# ── Serve the React SPA ────────────────────────────────────────────────────────
# IMPORTANT: This must be the LAST thing added to the app.
_dist = _get_frontend_dist()
if _dist:
    index_html = os.path.join(_dist, "index.html")
    
    # Mount assets folder if present
    assets_dir = os.path.join(_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        # Do not catch API or documentation routes
        if full_path.startswith("api/") or full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("redoc"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})

        # If direct static file exists in dist (e.g. favicon.svg, icons.svg, etc.)
        if full_path:
            file_path = os.path.join(_dist, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)

        # Fallback to index.html for all client-side routes (/login, /dashboard, /files, etc.)
        if os.path.isfile(index_html):
            return FileResponse(index_html)

        return JSONResponse(status_code=404, content={"detail": "Frontend index.html not found"})
else:
    @app.get("/")
    def read_root():
        return {"success": True, "message": "Welcome to AetherVault API", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=False)

