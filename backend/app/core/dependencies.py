from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.core.security import decode_access_token
from backend.app.core.exceptions import AuthException
from backend.app.models.user import User

# Token URL relative to base API
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

from fastapi import Query

def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    token_query: str | None = Query(None, alias="token"),
    db: Session = Depends(get_db)
) -> User:
    active_token = token or token_query
    if not active_token:
        raise AuthException("Authentication credentials missing")
    
    payload = decode_access_token(active_token)
    if not payload:
        raise AuthException("Session expired or invalid token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise AuthException("Invalid authentication token payload")
        
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise AuthException("User not found")
    if not user.is_active:
        raise AuthException("User account is inactive")
        
    return user
