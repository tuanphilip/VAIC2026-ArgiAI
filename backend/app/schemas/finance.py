from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field

class FinanceTransactionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    type: str = Field(pattern="^(income|expense)$")
    amount: float = Field(ge=0)
    category: str = Field(min_length=1, max_length=100)
    transaction_date: date = date.today()

class FinanceTransactionResponse(BaseModel):
    id: UUID
    title: str
    type: str
    amount: float
    category: str
    transaction_date: date
    created_at: datetime
    model_config = {"from_attributes": True}
