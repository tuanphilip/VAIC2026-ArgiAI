from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import ShipmentRecord, User
from app.schemas.shipment import ShipmentCreateRequest, ShipmentResponse, ShipmentStatusRequest

router = APIRouter(prefix="/shipments", tags=["Shipments"])


def _can_access(record: ShipmentRecord, user: User) -> bool:
    return user.role in {"official", "admin"} or record.owner_id == user.id


def _response(record: ShipmentRecord) -> ShipmentResponse:
    return ShipmentResponse.model_validate(record)


@router.get("", response_model=list[ShipmentResponse])
async def list_shipments(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(ShipmentRecord).order_by(ShipmentRecord.updated_at.desc())
    if current_user.role not in {"official", "admin"}:
        query = query.where(ShipmentRecord.owner_id == current_user.id)
    return [_response(row) for row in (await db.execute(query)).scalars().all()]


@router.post("", response_model=ShipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_shipment(payload: ShipmentCreateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = (await db.execute(select(ShipmentRecord).where(ShipmentRecord.shipment_code == payload.shipment_code))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Mã lô hàng đã tồn tại")
    row = ShipmentRecord(owner_id=current_user.id, **payload.model_dump())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _response(row)


@router.get("/{shipment_id}", response_model=ShipmentResponse)
async def get_shipment(shipment_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = await _get(db, shipment_id)
    if not _can_access(row, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem lô hàng này")
    return _response(row)


@router.patch("/{shipment_id}/status", response_model=ShipmentResponse)
async def update_shipment_status(shipment_id: UUID, payload: ShipmentStatusRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = await _get(db, shipment_id)
    if not _can_access(row, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền cập nhật lô hàng này")
    row.status = payload.status
    data = dict(row.payload or {})
    events = list(data.get("events", []))
    events.append({"status": payload.status, "note": payload.note, "actor_id": str(current_user.id)})
    data["events"] = events
    row.payload = data
    await db.commit()
    await db.refresh(row)
    return _response(row)


@router.get("/{shipment_id}/events")
async def shipment_events(shipment_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = await _get(db, shipment_id)
    if not _can_access(row, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem lô hàng này")
    return list((row.payload or {}).get("events", []))


async def _get(db: AsyncSession, shipment_id: UUID) -> ShipmentRecord:
    row = (await db.execute(select(ShipmentRecord).where(ShipmentRecord.id == shipment_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy lô hàng")
    return row
