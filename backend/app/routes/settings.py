from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import User, UserSettings
from app.schemas.settings import SettingsPayload, SettingsResponse
router=APIRouter(prefix="/settings",tags=["Settings"])
@router.get("",response_model=SettingsResponse)
async def get_settings(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 row=(await db.execute(select(UserSettings).where(UserSettings.owner_id==u.id))).scalar_one_or_none()
 if row is None:
  row=UserSettings(owner_id=u.id,settings={});db.add(row);await db.commit();await db.refresh(row)
 return row
@router.put("",response_model=SettingsResponse)
async def update_settings(p:SettingsPayload,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 row=(await db.execute(select(UserSettings).where(UserSettings.owner_id==u.id))).scalar_one_or_none()
 if row is None: row=UserSettings(owner_id=u.id,settings=p.settings);db.add(row)
 else: row.settings=p.settings
 await db.commit();await db.refresh(row);return row
