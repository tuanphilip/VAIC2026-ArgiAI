from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends, status
from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import FinanceTransaction, User
from app.schemas.finance import FinanceTransactionCreate, FinanceTransactionResponse

router=APIRouter(prefix="/finance", tags=["Finance"])

def scope(query, user):
    return query if user.role in {"official","admin"} else query.where(FinanceTransaction.owner_id==user.id)

@router.get("/transactions", response_model=list[FinanceTransactionResponse])
async def list_transactions(db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    rows=(await db.execute(scope(select(FinanceTransaction).order_by(FinanceTransaction.transaction_date.desc()),current_user))).scalars().all()
    return rows

@router.post("/transactions", response_model=FinanceTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(payload: FinanceTransactionCreate, db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    row=FinanceTransaction(owner_id=current_user.id, **payload.model_dump()); db.add(row); await db.commit(); await db.refresh(row); return row

@router.get("/summary")
async def finance_summary(db: AsyncSession=Depends(get_db), current_user: User=Depends(get_current_user)):
    rows=(await db.execute(scope(select(FinanceTransaction),current_user))).scalars().all()
    income=sum(r.amount for r in rows if r.type=="income"); expense=sum(r.amount for r in rows if r.type=="expense")
    return {"income":income,"expense":expense,"profit":income-expense,"transaction_count":len(rows)}
