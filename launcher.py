"""
AetherVault Launcher
====================
Single-file entry point used by PyInstaller to build AetherVault.exe.
- Starts the FastAPI/uvicorn backend in a background thread
- Waits until the server is ready (health-poll)
- Opens the default browser at http://localhost:8000
- Shows a system-tray-friendly console window with a clean shutdown prompt
"""

import os
import sys
import time
import socket
import threading
import webbrowser

# ── PyInstaller path fix ───────────────────────────────────────────────────────
# When frozen, _MEIPASS is the temp directory where all bundled files are extracted.
if getattr(sys, "frozen", False):
    _BASE = sys._MEIPASS          # type: ignore[attr-defined]
    # Make sure imports from the bundle work
    sys.path.insert(0, _BASE)
    # Set working directory to the folder that contains the exe so that
    # relative paths (storage/, app.db, .env) resolve correctly.
    os.chdir(os.path.dirname(sys.executable))
else:
    _BASE = os.path.abspath(os.path.dirname(__file__))
    sys.path.insert(0, _BASE)

PORT = 8000
HOST = "127.0.0.1"
URL  = f"http://{HOST}:{PORT}"


def _is_port_open(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=1):
            return True
    except OSError:
        return False


def _start_server():
    """Run uvicorn in this thread (blocking)."""
    import uvicorn
    from backend.app.main import app
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        reload=False,
        log_level="info",
    )


def main():
    print("=" * 54)
    print("  AetherVault — AI-Powered Personal Cloud Storage")
    print("=" * 54)
    print(f"\n  Starting server on {URL} ...")

    # Start uvicorn in a daemon thread so it dies when the main process exits
    server_thread = threading.Thread(target=_start_server, daemon=True)
    server_thread.start()

    # Poll until the server accepts connections (max 30 s)
    timeout = 30
    start = time.time()
    ready = False
    while time.time() - start < timeout:
        if _is_port_open(HOST, PORT):
            ready = True
            break
        time.sleep(0.3)

    if not ready:
        print("\n  [ERROR] Server did not start within 30 seconds.")
        print("  Check that port 8000 is not already in use.")
        input("\n  Press Enter to exit...")
        sys.exit(1)

    print(f"  Server ready!  Opening browser → {URL}\n")
    webbrowser.open(URL)

    print("  AetherVault is running. Press Ctrl+C or close this")
    print("  window to stop the server.\n")

    try:
        # Keep the main thread alive (uvicorn runs in the daemon thread)
        while server_thread.is_alive():
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n  Shutting down AetherVault. Goodbye!")


if __name__ == "__main__":
    main()
