import os
import re
from backend.app.core.exceptions import PathTraversalException

def sanitize_filename(filename: str) -> str:
    """Sanitize the uploaded filename by stripping traversal markers and non-standard chars."""
    # Strip path details
    filename = os.path.basename(filename)
    # Remove non-safe characters
    filename = re.sub(r'[^a-zA-Z0-9._\s-]', '', filename)
    filename = filename.strip()
    if not filename or filename in ('.', '..'):
        filename = "uploaded_file"
    return filename

def validate_safe_path(storage_root: str, user_id: int, relative_filename: str) -> str:
    """Resolve and validate a path inside a user's isolated storage root to block path traversal."""
    user_storage_dir = os.path.abspath(os.path.join(storage_root, "users", f"user_{user_id}"))
    target_path = os.path.abspath(os.path.join(user_storage_dir, relative_filename))
    
    # Ensure resolved path is strictly inside the user's root folder
    if not (target_path.startswith(user_storage_dir + os.sep) or target_path == user_storage_dir):
        raise PathTraversalException("Requested path is outside user workspace sandbox")
        
    return target_path

def get_file_category(extension: str) -> str:
    """Classify file extension into logical categories for stats dashboard."""
    ext = extension.lower().lstrip('.')
    categories = {
        'document': ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp', 'md'],
        'image': ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'],
        'video': ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mpeg'],
        'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
        'archive': ['zip', 'rar', 'tar', 'gz', '7z', 'bz2']
    }
    for category, extensions in categories.items():
        if ext in extensions:
            return category
    return 'other'
