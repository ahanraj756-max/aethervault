@echo off
title AetherVault Builder
echo ============================================================
echo   AetherVault - Build Script
echo ============================================================
echo.

echo [1/3] Building React frontend...
cd /d "%~dp0frontend"
call npm install --silent
call npm run build
if errorlevel 1 (
    echo ERROR: Frontend build failed. Aborting.
    pause
    exit /b 1
)
cd /d "%~dp0"
echo       Done - frontend\dist\ created
echo.

echo [2/3] Installing Python dependencies...
pip install -r backend\requirements.txt -q
pip install pyinstaller -q
if errorlevel 1 (
    echo ERROR: pip install failed. Aborting.
    pause
    exit /b 1
)
echo       Done
echo.

echo [3/3] Packaging with PyInstaller (1-3 minutes)...
python -m pip install pyinstaller -q
python -m PyInstaller AetherVault.spec --noconfirm --clean
if errorlevel 1 (
    echo ERROR: PyInstaller failed.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD COMPLETE!
echo   Your exe is at: dist\AetherVault\AetherVault.exe
echo   Double-click it to launch AetherVault.
echo ============================================================
echo.
pause
