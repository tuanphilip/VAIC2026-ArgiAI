from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    contact: str | None = None
    email: str | None = None
    address: str | None = None
class SupplierResponse(SupplierCreate):
    id: UUID; created_at: datetime
    model_config={"from_attributes":True}
class PurchaseRequestCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=150)
    quantity: float = Field(gt=0)
    supplier_id: UUID | None = None
class PurchaseRequestResponse(PurchaseRequestCreate):
    id: UUID; status: str; created_at: datetime
    model_config={"from_attributes":True}
class StockTransferCreate(BaseModel):
    item_name: str = Field(min_length=1, max_length=150)
    quantity: float = Field(gt=0)
    source: str = Field(min_length=1, max_length=120)
    destination: str = Field(min_length=1, max_length=120)
class StockTransferResponse(StockTransferCreate):
    id: UUID; created_at: datetime
    model_config={"from_attributes":True}
