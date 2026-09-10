import os
import sys
import uvicorn

if __name__ == "__main__":
    # Add workspace directory to python search path
    sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
    
    print("Starting AetherVault Development Server...")
    print("API Documentation available at: http://localhost:8000/docs")
    
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
