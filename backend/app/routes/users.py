from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_roles
from app.database.session import get_db
from app.models import User
from app.schemas.users import UserDirectoryItem

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserDirectoryItem])
async def list_user_directory(
    search: str | None = Query(default=None, min_length=1, max_length=100),
    role: str | None = Query(default=None, pattern="^(farmer|official|admin)$"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("official", "admin")),
) -> list[UserDirectoryItem]:
    query = select(User).order_by(User.full_name.asc()).limit(100)
    if search:
        pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                User.citizen_id.ilike(pattern),
                User.email.ilike(pattern),
                User.phone_number.ilike(pattern),
            )
        )
    if role:
        query = query.where(User.role == role)
    result = await db.execute(query)
    return [
        UserDirectoryItem(
            user_id=user.id,
            username=user.username,
            full_name=user.full_name,
            role=user.role,
            citizen_id=user.citizen_id,
            email=user.email,
            phone_number=user.phone_number,
        )
        for user in result.scalars().all()
    ]
