from uuid import UUID

from pydantic import BaseModel, Field


class DiseaseDetectionData(BaseModel):
    disease_log_id: UUID
    detected_disease: str
    confidence: float
    severity: str
    treatment_measures: str
    image_url: str


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
