from pydantic import BaseModel


class SuccessMessage(BaseModel):
    status: str = "success"
    message: str
