import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.app.models.user import User
from backend.app.models.file import File
from backend.app.models.folder import Folder

def search_files(
    db: Session,
    user: User,
    query: str | None = None,
    category: str | None = None,
    extension: str | None = None,
    is_favorite: bool | None = None,
    size_category: str | None = None, # small, medium, large
    date_filter: str | None = None, # today, week, month
    start_date: datetime.datetime | None = None,
    end_date: datetime.datetime | None = None,
    folder_id: int | None = None
) -> list[File]:
    db_query = db.query(File).filter(File.user_id == user.id, File.is_trashed == False)
    
    # 1. Filename search
    if query:
        db_query = db_query.filter(File.original_filename.ilike(f"%{query}%"))
        
    # 2. Folder Scope
    if folder_id is not None:
        db_query = db_query.filter(File.folder_id == folder_id)
        
    # 3. Favorite status
    if is_favorite is not None:
        db_query = db_query.filter(File.is_favorite == is_favorite)
        
    # 4. Specific Extension
    if extension:
        if not extension.startswith('.'):
            extension = f".{extension}"
        db_query = db_query.filter(File.extension == extension.lower())
        
    # 5. Category filter
    if category and category != 'all':
        ext_categories = {
            'document': ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp', '.md'],
            'image': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.tiff'],
            'video': ['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mpeg'],
            'audio': ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'],
            'archive': ['.zip', '.rar', '.tar', '.gz', '.7z', '.bz2']
        }
        target_exts = ext_categories.get(category.lower(), [])
        if target_exts:
            db_query = db_query.filter(File.extension.in_(target_exts))
            
    # 6. Size threshold filters
    if size_category:
        if size_category == 'small':
            db_query = db_query.filter(File.file_size <= 1024 * 1024) # <= 1MB
        elif size_category == 'medium':
            db_query = db_query.filter(File.file_size > 1024 * 1024, File.file_size <= 50 * 1024 * 1024) # 1MB to 50MB
        elif size_category == 'large':
            db_query = db_query.filter(File.file_size > 50 * 1024 * 1024) # > 50MB
            
    # 7. Date uploaded filters
    now = datetime.datetime.utcnow()
    if date_filter:
        if date_filter == 'today':
            today_start = datetime.datetime(now.year, now.month, now.day)
            db_query = db_query.filter(File.created_at >= today_start)
        elif date_filter == 'week':
            week_start = now - datetime.timedelta(days=7)
            db_query = db_query.filter(File.created_at >= week_start)
        elif date_filter == 'month':
            month_start = now - datetime.timedelta(days=30)
            db_query = db_query.filter(File.created_at >= month_start)
            
    if start_date:
        db_query = db_query.filter(File.created_at >= start_date)
    if end_date:
        db_query = db_query.filter(File.created_at <= end_date)
        
    return db_query.order_by(File.created_at.desc()).all()
