import secrets
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import TraceabilityLabel, User
from app.schemas.traceability import LabelCreate, LabelResponse
router=APIRouter(prefix="/traceability",tags=["Traceability"])
@router.get("/labels",response_model=list[LabelResponse])
async def labels(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 q=select(TraceabilityLabel).order_by(TraceabilityLabel.created_at.desc())
 if u.role not in {"official","admin"}: q=q.where(TraceabilityLabel.owner_id==u.id)
 return (await db.execute(q)).scalars().all()
@router.post("/labels",response_model=LabelResponse,status_code=status.HTTP_201_CREATED)
async def create_label(p:LabelCreate,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 qr=f"ARGI-{secrets.token_hex(6).upper()}"
 row=TraceabilityLabel(owner_id=u.id,qr_value=qr,**p.model_dump());db.add(row);await db.commit();await db.refresh(row);return row
