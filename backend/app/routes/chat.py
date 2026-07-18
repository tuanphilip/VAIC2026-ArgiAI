from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import User
from app.schemas.chat import ChatCitationResponse, ChatRequest, ChatResponse, ChatSectionResponse
from app.services.chat_assistant import AgriculturalChatAssistant

router = APIRouter(prefix="/chat", tags=["Agricultural chat"])
_assistant = AgriculturalChatAssistant()


@router.post("/answer", response_model=ChatResponse)
async def answer(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    del current_user, db  # persistence is intentionally isolated for the first vertical slice
    history = [(turn.role, turn.content) for turn in payload.history]
    result = _assistant.answer(payload.message, history)
    return ChatResponse(
        intent=result.intent,
        sections=[ChatSectionResponse(title=item.title, content=item.content) for item in result.sections],
        quick_replies=result.quick_replies,
        citations=[ChatCitationResponse(evidence_id=item.evidence_id, title=item.title, source_url=item.source_url) for item in result.citations],
        confidence=result.confidence,
    )
