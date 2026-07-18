from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DiseaseDetectionData(BaseModel):
    disease_log_id: UUID
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    image_url: str
    review_required: bool = True


class DiseaseDetectionResponse(BaseModel):
    status: str = "success"
    data: DiseaseDetectionData


class DiseaseLogItem(BaseModel):
    id: UUID
    reporter: str
    plot_id: str | None = None
    crop: str | None = None
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    image_url: str
    status: str
    official_notes: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class DiseaseLogListResponse(BaseModel):
    items: list[DiseaseLogItem]
    total: int
    active: int
    resolved: int


class DiseaseStatusUpdateRequest(BaseModel):
    status: str = Field(pattern="^(active|resolved)$")
    official_notes: str | None = None


class DiseaseStatusUpdateResponse(BaseModel):
    status: str = "success"
    message: str = "Disease log status updated successfully"
    disease_log_id: UUID
