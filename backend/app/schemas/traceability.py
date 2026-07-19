from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field
class LabelCreate(BaseModel):
 lot_name:str=Field(min_length=1,max_length=200); harvest_date:date; standard:str=Field(min_length=1,max_length=80); farmer:str=Field(min_length=1,max_length=150)
class LabelResponse(LabelCreate):
 id:UUID; qr_value:str; created_at:datetime
 model_config={"from_attributes":True}
