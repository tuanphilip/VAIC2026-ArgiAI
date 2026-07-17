from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Crop


async def find_crop(db: AsyncSession, name: str, variety: str | None = None) -> Crop | None:
    query = select(Crop).where(Crop.name.ilike(name))
    if variety:
        query = query.where(Crop.variety.ilike(variety))
    result = await db.execute(query.limit(1))
    crop = result.scalar_one_or_none()
    if crop:
        return crop

    fallback = await db.execute(
        select(Crop)
        .where(or_(Crop.name.ilike(f"%{name}%"), Crop.variety.ilike(f"%{name}%")))
        .order_by(Crop.name)
        .limit(1)
    )
    return fallback.scalar_one_or_none()


async def get_or_create_crop(
    db: AsyncSession,
    name: str,
    variety: str | None = None,
    growth_duration_days: int = 120,
) -> Crop:
    crop = await find_crop(db, name, variety)
    if crop:
        return crop
    crop = Crop(name=name, variety=variety or "Địa phương", growth_duration_days=growth_duration_days)
    db.add(crop)
    await db.flush()
    return crop
