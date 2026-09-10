import os
from sqlalchemy.orm import Session
from backend.app.models.user import User
from backend.app.schemas.auth import UserRegister, UserLogin
from backend.app.core.security import hash_password, verify_password, create_access_token
from backend.app.core.exceptions import AuthException
from backend.app.config import settings

def register_user(db: Session, data: UserRegister) -> User:
    # Check duplicate username
    if db.query(User).filter(User.username == data.username).first():
        raise AuthException("Username is already registered", status_code=400)
    
    # Check duplicate email
    if db.query(User).filter(User.email == data.email).first():
        raise AuthException("Email is already registered", status_code=400)
    
    # Calculate default storage quota (10GB)
    default_quota = settings.DEFAULT_STORAGE_QUOTA_GB * 1024 * 1024 * 1024
    
    # Create user
    db_user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        role="user",
        storage_quota=default_quota,
        storage_used=0,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create user's physical sandbox directories
    user_sandbox = os.path.abspath(os.path.join(settings.STORAGE_ROOT, "users", f"user_{db_user.id}"))
    os.makedirs(os.path.join(user_sandbox, "files"), exist_ok=True)
    os.makedirs(os.path.join(user_sandbox, "temp"), exist_ok=True)
    
    return db_user

def authenticate_user(db: Session, data: UserLogin) -> User:
    # Support username or email login
    user = db.query(User).filter(
        (User.username == data.username_or_email) | (User.email == data.username_or_email)
    ).first()
    
    if not user:
        raise AuthException("Invalid username or password")
        
    if not verify_password(data.password, user.password_hash):
        raise AuthException("Invalid username or password")
        
    if not user.is_active:
        raise AuthException("User account has been disabled")
        
    return user

def create_user_token(user: User) -> dict:
    access_token = create_access_token(data={"sub": str(user.id), "username": user.username, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer"}
