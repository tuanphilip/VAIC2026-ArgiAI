import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.database.session import get_db
from app.models import ChatMessage, ChatSession, User
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
    session = None
    if payload.session_id is not None:
        session = (
            await db.execute(
                select(ChatSession).where(
                    ChatSession.id == payload.session_id,
                    ChatSession.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    else:
        session = ChatSession(user_id=current_user.id, title=payload.message[:200])
        db.add(session)
        await db.flush()

    history = [(turn.role, turn.content) for turn in payload.history]
    if not history:
        stored = await db.execute(
            select(ChatMessage.role, ChatMessage.content)
            .where(ChatMessage.session_id == session.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(10)
        )
        history = list(reversed(stored.all()))

    result = await _assistant.answer_natural(payload.message, history)
    citations = [
        {"evidence_id": item.evidence_id, "title": item.title, "source_url": item.source_url}
        for item in result.citations
    ]
    assistant_text = "\n\n".join(
        f"{section.title}:\n" + "\n".join(section.content)
        for section in result.sections
    )
    db.add(
        ChatMessage(
            session_id=session.id,
            role="user",
            content=payload.message,
        )
    )
    db.add(
        ChatMessage(
            session_id=session.id,
            role="assistant",
            content=assistant_text,
            intent=result.intent,
            confidence=result.confidence,
            citations=citations,
        )
    )
    await db.execute(
        update(ChatSession).where(ChatSession.id == session.id).values(updated_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return ChatResponse(
        session_id=session.id,
        intent=result.intent,
        sections=[ChatSectionResponse(title=item.title, content=item.content) for item in result.sections],
        quick_replies=result.quick_replies,
        citations=[ChatCitationResponse(evidence_id=item.evidence_id, title=item.title, source_url=item.source_url) for item in result.citations],
        confidence=result.confidence,
    )


@router.post("/answer/stream")
async def answer_stream(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    response = await answer(payload, current_user, db)

    async def events():
        yield f"data: {json.dumps({'type': 'meta', 'response': response.model_dump(mode='json')}, ensure_ascii=False)}\n\n"
        for section in response.sections:
            text = f"{section.title}\n" + "\n".join(section.content) + "\n\n"
            for index in range(0, len(text), 24):
                yield f"data: {json.dumps({'type': 'token', 'text': text[index:index + 24]}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.01)
        yield "data: {\"type\":\"done\"}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
