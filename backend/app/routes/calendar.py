from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import SeasonalEvent, User
from app.schemas.calendar import EventCreate, EventResponse
router=APIRouter(prefix="/calendar",tags=["Calendar"])
@router.get("/events",response_model=list[EventResponse])
async def list_events(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 return (await db.execute(select(SeasonalEvent).where(SeasonalEvent.owner_id==u.id).order_by(SeasonalEvent.start_at))).scalars().all()
@router.post("/events",response_model=EventResponse,status_code=status.HTTP_201_CREATED)
async def create_event(p:EventCreate,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 row=SeasonalEvent(owner_id=u.id,**p.model_dump());db.add(row);await db.commit();await db.refresh(row);return row
