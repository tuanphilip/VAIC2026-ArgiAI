from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field
class EventCreate(BaseModel):
 title:str=Field(min_length=1,max_length=200); start_at:datetime; end_at:datetime|None=None; calendar_key:str="work"; description:str|None=None
class EventResponse(EventCreate):
 id:UUID; created_at:datetime
 model_config={"from_attributes":True}
