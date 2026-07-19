import json
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class DiseaseProfile:
    name: str
    aliases: list[str]
    severity_default: str
    symptoms: list[str]
    favorable_conditions: list[str]
    ipm_treatment: list[str]
    do_not: list[str]
    sources: list[str]
    disease_id: str = ""
    affected_parts: list[str] = field(default_factory=list)
    cause: str = ""
    pathogen_type: str = ""
    growth_stages: list[str] = field(default_factory=list)
    severity_criteria: list[str] = field(default_factory=list)
    biological_treatment: list[str] = field(default_factory=list)
    chemical_treatment: list[str] = field(default_factory=list)
    active_ingredients: list[str] = field(default_factory=list)
    prevention: list[str] = field(default_factory=list)
    follow_up_questions: list[str] = field(default_factory=list)
    weather_rule: "WeatherRule | None" = None


@dataclass(frozen=True)
class WeatherRule:
    min_temperature_c: float | None = None
    max_temperature_c: float | None = None
    min_relative_humidity: float | None = None
    min_rainfall_72h_mm: float | None = None


@dataclass(frozen=True)
class CropProfile:
    crop: str
    aliases: list[str]
    local_sources: list[str] = field(default_factory=list)
    diseases: list[DiseaseProfile] = field(default_factory=list)


class DiseaseKnowledgeRepository:
    def __init__(self, data_path: Path | None = None) -> None:
        self.data_path = data_path or Path(__file__).resolve().parents[1] / "data" / "disease_knowledge.vi.json"
        self.version, self.crops = _load_profiles(self.data_path)

    def find_crop(self, crop_name: str | None) -> CropProfile | None:
        if not crop_name:
            return None
        normalized = normalize_text(crop_name)
        for crop in self.crops:
            crop_names = [crop.crop, *crop.aliases]
            if any(normalize_text(name) in normalized or normalized in normalize_text(name) for name in crop_names):
                return crop
        return None

    def supported_diseases(self, crop_name: str | None) -> list[str]:
        crop = self.find_crop(crop_name)
        if crop:
            return [disease.name for disease in crop.diseases]
        return [disease.name for crop_profile in self.crops for disease in crop_profile.diseases]

    def find_disease(self, crop_name: str | None, disease_name: str | None) -> DiseaseProfile | None:
        if not disease_name:
            return None
        normalized = normalize_text(disease_name)
        crops = [self.find_crop(crop_name)] if self.find_crop(crop_name) else self.crops
        for crop in [item for item in crops if item is not None]:
            for disease in crop.diseases:
                names = [disease.name, *disease.aliases]
                if any(normalize_text(name) in normalized or normalized in normalize_text(name) for name in names):
                    return disease
        return None

    def symptom_match_score(self, disease: DiseaseProfile | None, evidence: str) -> float:
        if disease is None or not evidence:
            return 0.0
        normalized_evidence = normalize_text(evidence)
        matched = [
            symptom
            for symptom in disease.symptoms
            if any(token in normalized_evidence for token in _meaningful_tokens(symptom))
        ]
        return min(len(matched) / max(len(disease.symptoms), 1), 1.0)


def normalize_text(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.lower())
    without_marks = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    return " ".join(without_marks.replace("/", " ").replace("-", " ").split())


def _meaningful_tokens(value: str) -> list[str]:
    stopwords = {"benh", "cay", "la", "qua", "than", "tren", "duoi", "va", "hoac"}
    return [token for token in normalize_text(value).split() if len(token) > 2 and token not in stopwords]


@lru_cache
def _load_profiles(data_path: Path) -> tuple[str, list[CropProfile]]:
    data = json.loads(data_path.read_text(encoding="utf-8"))
    return (
        str(data.get("version") or "unversioned"),
        [_parse_crop(item) for item in data.get("crops", [])],
    )


def _parse_crop(item: dict[str, Any]) -> CropProfile:
    local_relevance = item.get("local_relevance") or {}
    return CropProfile(
        crop=str(item.get("crop") or ""),
        aliases=[str(alias) for alias in item.get("aliases", [])],
        local_sources=[str(source) for source in local_relevance.get("sources", [])],
        diseases=[_parse_disease(disease) for disease in item.get("diseases", [])],
    )


def _parse_disease(item: dict[str, Any]) -> DiseaseProfile:
    return DiseaseProfile(
        name=str(item.get("name") or ""),
        aliases=[str(alias) for alias in item.get("aliases", [])],
        severity_default=str(item.get("severity_default") or "Trung bình"),
        symptoms=[str(symptom) for symptom in item.get("symptoms", [])],
        favorable_conditions=[str(condition) for condition in item.get("favorable_conditions", [])],
        ipm_treatment=[str(step) for step in item.get("ipm_treatment", [])],
        do_not=[str(warning) for warning in item.get("do_not", [])],
        sources=[str(source) for source in item.get("sources", [])],
        disease_id=str(item.get("id") or ""),
        affected_parts=[str(part) for part in item.get("affected_parts", [])],
        cause=str(item.get("cause") or ""),
        pathogen_type=str(item.get("pathogen_type") or ""),
        growth_stages=[str(stage) for stage in item.get("growth_stages", [])],
        severity_criteria=[str(criterion) for criterion in item.get("severity_criteria", [])],
        biological_treatment=[str(step) for step in item.get("biological_treatment", [])],
        chemical_treatment=[str(step) for step in item.get("chemical_treatment", [])],
        active_ingredients=[str(name) for name in item.get("active_ingredients", [])],
        prevention=[str(step) for step in item.get("prevention", [])],
        follow_up_questions=[str(question) for question in item.get("follow_up_questions", [])],
        weather_rule=_parse_weather_rule(item.get("weather_rule")),
    )


def _parse_weather_rule(value: Any) -> WeatherRule | None:
    if not isinstance(value, dict) or not value:
        return None
    return WeatherRule(
        min_temperature_c=_optional_float(value.get("min_temperature_c")),
        max_temperature_c=_optional_float(value.get("max_temperature_c")),
        min_relative_humidity=_optional_float(value.get("min_relative_humidity")),
        min_rainfall_72h_mm=_optional_float(value.get("min_rainfall_72h_mm")),
    )


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
