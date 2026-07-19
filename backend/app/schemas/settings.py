from datetime import datetime
from typing import Any
from pydantic import BaseModel
class SettingsPayload(BaseModel):
 settings: dict[str, Any]
class SettingsResponse(BaseModel):
 settings: dict[str, Any]
 updated_at: datetime
 model_config={"from_attributes":True}
