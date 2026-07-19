from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DiseaseEvidenceResponse(BaseModel):
    evidence_id: str
    title: str
    section: str
    content: str
    source_url: str = ""
    authority: str
    retrieval_score: float


class DiseaseDetectionData(BaseModel):
    disease_log_id: UUID | None = None
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    image_url: str
    crop: str | None = None
    source: str = "gemini"
    diagnosis_mode: str = "vision"
    saved_to_history: bool = False
    needs_human_review: bool = False
    warnings: list[str] = Field(default_factory=list)
    visual_evidence: str = ""
    top_candidates: list[dict[str, str | float]] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)
    quality_score: float = 0.0
    final_score: float = 0.0
    diagnosis_explanation: str = ""
    evidence_items: list[DiseaseEvidenceResponse] = Field(default_factory=list)
    confidence_breakdown: dict[str, float] = Field(default_factory=dict)
    follow_up_questions: list[str] = Field(default_factory=list)
    knowledge_version: str = ""
    weather_summary: str | None = None
    recommendation_status: str = "review_required"


class DiseaseDetectionResponse(BaseModel):
    status: str = "success"
    data: DiseaseDetectionData


class DiseaseStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|resolved)$")
    official_notes: str | None = None


class DiseaseStatusUpdateResponse(BaseModel):
    status: str = "success"
    message: str = "Disease log status updated successfully"
    disease_log_id: UUID


class DiseaseFeedbackRequest(BaseModel):
    is_ai_correct: bool
    correct_crop: str | None = None
    correct_disease: str | None = None
    correct_severity: str | None = None
    expert_notes: str | None = None
    approved_treatment: str | None = None


class DiseaseFeedbackResponse(BaseModel):
    status: str = "success"
    message: str = "Disease feedback saved"
    disease_log_id: UUID


class DiseaseLogResponse(BaseModel):
    id: UUID
    plot_id: UUID | None = None
    reporter_name: str
    location: str | None = None
    crop_name: str | None = None
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    status: str
    official_notes: str | None = None
    image_url: str
    created_at: datetime
    resolved_at: datetime | None = None
