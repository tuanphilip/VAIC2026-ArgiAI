from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.disease_knowledge import (
    CropProfile,
    DiseaseKnowledgeRepository,
    DiseaseProfile,
    normalize_text,
)


@dataclass(frozen=True)
class KnowledgeEvidence:
    evidence_id: str
    title: str
    section: str
    content: str
    source_url: str
    authority: str
    retrieval_score: float


@dataclass(frozen=True)
class RetrievalResult:
    disease_profile: DiseaseProfile | None
    evidence: list[KnowledgeEvidence]
    support_score: float
    knowledge_version: str


class AgriculturalKnowledgeRetriever:
    """Deterministic retrieval over the reviewed disease catalog.

    This is the local production baseline. It deliberately avoids an LLM in
    retrieval and gives every returned statement a stable evidence identifier.
    """

    def __init__(self, knowledge: DiseaseKnowledgeRepository) -> None:
        self.knowledge = knowledge

    def retrieve(
        self,
        crop_name: str | None,
        disease_name: str | None,
        observed_evidence: str = "",
        top_k: int = 8,
    ) -> RetrievalResult:
        crop = self.knowledge.find_crop(crop_name)
        disease = self.knowledge.find_disease(crop_name, disease_name)
        if crop is None or disease is None:
            return RetrievalResult(
                disease_profile=disease,
                evidence=[],
                support_score=0.0,
                knowledge_version=self.knowledge.version,
            )

        query = " ".join(
            value
            for value in [crop.crop, disease.name, observed_evidence]
            if value
        )
        chunks = self._build_chunks(crop, disease)
        ranked = sorted(
            (
                self._score_chunk(chunk, query, disease)
                for chunk in chunks
            ),
            key=lambda item: item.retrieval_score,
            reverse=True,
        )
        evidence = self._diversify(ranked, top_k)
        return RetrievalResult(
            disease_profile=disease,
            evidence=evidence,
            support_score=self._support_score(disease, evidence),
            knowledge_version=self.knowledge.version,
        )

    @staticmethod
    def _diversify(
        ranked: list[KnowledgeEvidence],
        top_k: int,
    ) -> list[KnowledgeEvidence]:
        preferred_sections = [
            "symptoms",
            "cause",
            "favorable_conditions",
            "ipm_treatment",
            "biological_treatment",
            "prevention",
            "safety",
            "chemical_treatment",
        ]
        selected: list[KnowledgeEvidence] = []
        selected_ids: set[str] = set()
        for section in preferred_sections:
            match = next(
                (
                    item
                    for item in ranked
                    if item.section == section and item.retrieval_score > 0
                ),
                None,
            )
            if match is not None:
                selected.append(match)
                selected_ids.add(match.evidence_id)
            if len(selected) >= top_k:
                return selected

        for item in ranked:
            if item.retrieval_score <= 0 or item.evidence_id in selected_ids:
                continue
            selected.append(item)
            if len(selected) >= top_k:
                break
        return selected

    def _build_chunks(
        self,
        crop: CropProfile,
        disease: DiseaseProfile,
    ) -> list[KnowledgeEvidence]:
        source_url = disease.sources[0] if disease.sources else ""
        authority = _source_authority(source_url)
        disease_id = disease.disease_id or _slug(disease.name)
        sections: list[tuple[str, list[str]]] = [
            ("symptoms", disease.symptoms),
            ("affected_parts", disease.affected_parts),
            ("cause", [disease.cause] if disease.cause else []),
            ("favorable_conditions", disease.favorable_conditions),
            ("growth_stages", disease.growth_stages),
            ("severity", disease.severity_criteria),
            ("ipm_treatment", disease.ipm_treatment),
            ("biological_treatment", disease.biological_treatment),
            ("chemical_treatment", disease.chemical_treatment),
            ("prevention", disease.prevention),
            ("safety", disease.do_not),
        ]

        chunks: list[KnowledgeEvidence] = []
        for section, values in sections:
            for index, content in enumerate(values, start=1):
                if not content.strip():
                    continue
                chunks.append(
                    KnowledgeEvidence(
                        evidence_id=f"{disease_id}:{section}:{index}",
                        title=f"{crop.crop} - {disease.name}",
                        section=section,
                        content=content.strip(),
                        source_url=source_url,
                        authority=authority,
                        retrieval_score=0.0,
                    )
                )
        return chunks

    def _score_chunk(
        self,
        chunk: KnowledgeEvidence,
        query: str,
        disease: DiseaseProfile,
    ) -> KnowledgeEvidence:
        query_tokens = _tokens(query)
        content_tokens = _tokens(f"{disease.name} {chunk.content}")
        overlap = len(query_tokens & content_tokens) / max(len(content_tokens), 1)
        section_priority = {
            "symptoms": 0.12,
            "affected_parts": 0.10,
            "cause": 0.08,
            "favorable_conditions": 0.08,
            "growth_stages": 0.06,
            "severity": 0.06,
            "ipm_treatment": 0.12,
            "biological_treatment": 0.12,
            "chemical_treatment": 0.04,
            "prevention": 0.10,
            "safety": 0.08,
        }.get(chunk.section, 0.0)
        authority_score = {
            "primary": 0.10,
            "government": 0.09,
            "research": 0.08,
            "reviewed": 0.06,
        }.get(chunk.authority, 0.03)
        score = min(0.58 + 0.20 * overlap + section_priority + authority_score, 1.0)
        return KnowledgeEvidence(
            evidence_id=chunk.evidence_id,
            title=chunk.title,
            section=chunk.section,
            content=chunk.content,
            source_url=chunk.source_url,
            authority=chunk.authority,
            retrieval_score=round(score, 3),
        )

    @staticmethod
    def _support_score(
        disease: DiseaseProfile,
        evidence: list[KnowledgeEvidence],
    ) -> float:
        sections = {item.section for item in evidence}
        score = 0.0
        score += 0.25 if disease.sources else 0.0
        score += 0.20 if "symptoms" in sections else 0.0
        score += 0.15 if "cause" in sections else 0.0
        score += 0.20 if sections & {"ipm_treatment", "biological_treatment"} else 0.0
        score += 0.10 if "prevention" in sections else 0.0
        score += 0.10 if "safety" in sections else 0.0
        return round(min(score, 1.0), 3)


def _tokens(value: str) -> set[str]:
    stopwords = {
        "benh",
        "cay",
        "trong",
        "tren",
        "duoi",
        "va",
        "hoac",
        "mot",
        "nhung",
        "khi",
        "theo",
    }
    return {
        token
        for token in normalize_text(value).split()
        if len(token) > 2 and token not in stopwords
    }


def _slug(value: str) -> str:
    return "-".join(normalize_text(value).split())


def _source_authority(url: str) -> str:
    hostname = (urlparse(url).hostname or "").lower()
    if any(domain in hostname for domain in ("irri.org", "fao.org", "cabi.org")):
        return "primary"
    if hostname.endswith(".gov.vn") or ".gov." in hostname:
        return "government"
    if any(domain in hostname for domain in ("cgiar.org", "edu", "agris.fao.org")):
        return "research"
    return "reviewed"
