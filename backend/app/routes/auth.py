from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import User
from app.schemas.auth import AuthUser, LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, RegisterResponseData

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> RegisterResponse:
    conditions = [User.username == payload.username]
    if payload.email:
        conditions.append(User.email == str(payload.email))
    if payload.citizen_id:
        conditions.append(User.citizen_id == payload.citizen_id)
    existing = await db.execute(select(User).where(or_(*conditions)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        email=str(payload.email) if payload.email else None,
        citizen_id=payload.citizen_id,
        phone_number=payload.phone_number,
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return RegisterResponse(
        data=RegisterResponseData(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            citizen_id=user.citizen_id,
            email=user.email,
            phone_number=user.phone_number,
        )
    )


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> LoginResponse:
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")

    return LoginResponse(
        access_token=create_access_token(user.id, user.role),
        user=AuthUser(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            citizen_id=user.citizen_id,
            email=user.email,
            phone_number=user.phone_number,
        ),
    )
