from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.database.connection import get_db
from app.models.user import User
from app.schemas.auth import AuthUserOut, LoginIn, LoginOut


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.email) == email))

    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoac mat khau khong dung",
        )

    return LoginOut(
        user=AuthUserOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        )
    )
