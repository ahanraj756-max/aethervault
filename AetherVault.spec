# -*- mode: python ; coding: utf-8 -*-
"""
AetherVault.spec  —  PyInstaller build spec
============================================
Build command (run from project root):
    pyinstaller AetherVault.spec

Output:  dist/AetherVault/AetherVault.exe   (one-folder bundle)
         dist/AetherVault.exe               (one-file bundle, slower cold start)

We use one-folder mode so startup is fast and the exe is not flagged by
antivirus software (one-file mode unpacks to %TEMP% on every launch).
"""

import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT = os.path.abspath(SPECPATH)          # noqa: F821  (PyInstaller magic var)
FRONTEND_DIST = os.path.join(ROOT, "frontend", "dist")
BACKEND_DIR   = os.path.join(ROOT, "backend")
ENV_FILE      = os.path.join(ROOT, ".env")

# ── Collect all packages that use dynamic imports ──────────────────────────────
datas   = []
hiddenimports = []
binaries = []

for pkg in ["uvicorn", "fastapi", "starlette", "pydantic", "pydantic_settings",
            "sqlalchemy", "bcrypt", "jwt", "pypdf", "docx", "google.genai",
            "email_validator", "multipart", "anyio", "h11", "httptools",
            "watchfiles", "websockets"]:
    try:
        d, b, h = collect_all(pkg)
        datas    += d
        binaries += b
        hiddenimports += h
    except Exception:
        pass

# SQLite + SQLAlchemy dialects
hiddenimports += collect_submodules("sqlalchemy.dialects")
hiddenimports += collect_submodules("sqlalchemy.pool")
hiddenimports += [
    "sqlalchemy.dialects.sqlite",
    "backend.app.models",
    "backend.app.models.user",
    "backend.app.models.file",
    "backend.app.models.folder",
    "backend.app.models.ai_metadata",
    "backend.app.models.activity",
    "backend.app.routers.auth",
    "backend.app.routers.files",
    "backend.app.routers.folders",
    "backend.app.routers.storage",
    "backend.app.routers.search",
    "backend.app.routers.ai",
    "backend.app.services.ai_service",
    "backend.app.services.file_service",
    "backend.app.services.auth_service",
    "backend.app.services.folder_service",
    "backend.app.services.search_service",
    "backend.app.services.storage_service",
    "backend.app.services.duplicate_service",
    "backend.app.core.dependencies",
    "backend.app.core.security",
    "backend.app.core.exceptions",
    "backend.app.core.logging",
    "backend.app.utils.file_utils",
    "backend.app.utils.hashing",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
]

# ── Include data files ─────────────────────────────────────────────────────────
datas += [
    # Built React frontend (served as static files)
    (FRONTEND_DIST, "frontend_dist"),
    # .env config
    (ENV_FILE, "."),
    # Backend source (needed for dynamic imports)
    (BACKEND_DIR, "backend"),
]

# ── Analysis ───────────────────────────────────────────────────────────────────
a = Analysis(
    ["launcher.py"],
    pathex=[ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "numpy", "pandas", "scipy", "PIL",
              "IPython", "notebook", "pytest"],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="AetherVault",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,           # keep console so users see startup status
    icon=os.path.join(ROOT, "AetherVault.ico"),
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="AetherVault",
)
