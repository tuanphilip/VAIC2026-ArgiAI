from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserDirectoryItem(BaseModel):
    user_id: UUID
    username: str
    full_name: str
    role: str
    citizen_id: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
