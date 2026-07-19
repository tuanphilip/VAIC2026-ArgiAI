from uuid import UUID

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    session_id: UUID | None = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ChatSectionResponse(BaseModel):
    title: str
    content: list[str]


class ChatCitationResponse(BaseModel):
    evidence_id: str
    title: str
    source_url: str


class ChatResponse(BaseModel):
    session_id: UUID
    intent: str
    sections: list[ChatSectionResponse]
    quick_replies: list[str]
    citations: list[ChatCitationResponse]
    confidence: float
