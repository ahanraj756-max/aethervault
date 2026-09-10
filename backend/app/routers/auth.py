from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.app.database import get_db
from backend.app.schemas.auth import UserRegister, UserLogin, UserResponse
from backend.app.services import auth_service
from backend.app.core.dependencies import get_current_user
from backend.app.models.user import User

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: UserRegister, db: Session = Depends(get_db)):
    user = auth_service.register_user(db, data)
    return {
        "success": True,
        "message": "Account created successfully",
        "data": UserResponse.model_validate(user)
    }

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, data)
    token_data = auth_service.create_user_token(user)
    return {
        "success": True,
        "message": "Login successful",
        "data": {
            "token": token_data,
            "user": UserResponse.model_validate(user)
        }
    }

@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "message": "Logout successful"
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "success": True,
        "data": UserResponse.model_validate(current_user)
    }
