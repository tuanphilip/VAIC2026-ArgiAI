from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import PurchaseRequest, StockTransfer, Supplier, User
from app.schemas.procurement import *

router=APIRouter(prefix="/procurement", tags=["Procurement"])
def scoped(model,user):
 q=select(model).order_by(model.created_at.desc())
 return q if user.role in {"official","admin"} else q.where(model.owner_id==user.id)

@router.get("/suppliers",response_model=list[SupplierResponse])
async def suppliers(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 return (await db.execute(scoped(Supplier,u))).scalars().all()
@router.post("/suppliers",response_model=SupplierResponse,status_code=status.HTTP_201_CREATED)
async def create_supplier(p:SupplierCreate,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 r=Supplier(owner_id=u.id,**p.model_dump());db.add(r);await db.commit();await db.refresh(r);return r
@router.get("/purchase-requests",response_model=list[PurchaseRequestResponse])
async def purchase_requests(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 return (await db.execute(scoped(PurchaseRequest,u))).scalars().all()
@router.post("/purchase-requests",response_model=PurchaseRequestResponse,status_code=status.HTTP_201_CREATED)
async def create_purchase_request(p:PurchaseRequestCreate,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 r=PurchaseRequest(owner_id=u.id,**p.model_dump());db.add(r);await db.commit();await db.refresh(r);return r
@router.get("/stock-transfers",response_model=list[StockTransferResponse])
async def stock_transfers(db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 return (await db.execute(scoped(StockTransfer,u))).scalars().all()
@router.post("/stock-transfers",response_model=StockTransferResponse,status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(p:StockTransferCreate,db:AsyncSession=Depends(get_db),u:User=Depends(get_current_user)):
 r=StockTransfer(owner_id=u.id,**p.model_dump());db.add(r);await db.commit();await db.refresh(r);return r
