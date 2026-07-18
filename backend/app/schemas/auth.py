from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    email: EmailStr | None = None
    citizen_id: str | None = Field(default=None, min_length=12, max_length=12, pattern=r"^\d{12}$")
    phone_number: str | None = Field(default=None, max_length=20)
    full_name: str = Field(min_length=2, max_length=100)
    role: str = Field(default="farmer", pattern="^(farmer|official|admin)$")


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthUser(BaseModel):
    user_id: UUID
    username: str | None = None
    full_name: str
    role: str
    citizen_id: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None


class RegisterResponseData(AuthUser):
    pass


class RegisterResponse(BaseModel):
    status: str = "success"
    message: str = "User registered successfully"
    data: RegisterResponseData


class LoginResponse(BaseModel):
    status: str = "success"
    access_token: str
    token_type: str = "bearer"
    user: AuthUser
