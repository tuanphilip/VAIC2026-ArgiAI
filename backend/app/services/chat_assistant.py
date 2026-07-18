from dataclasses import dataclass
from typing import Literal

from app.services.agricultural_retriever import AgriculturalKnowledgeRetriever, KnowledgeEvidence
from app.services.disease_knowledge import CropProfile, DiseaseKnowledgeRepository, DiseaseProfile, normalize_text

Intent = Literal["disease", "technique", "weather", "out_of_scope"]

_SECTION_NAMES = (
    "Kết luận",
    "Nguyên nhân",
    "Độ tin cậy",
    "Triệu chứng",
    "Cách kiểm tra",
    "Hướng xử lý",
    "Sản phẩm đề xuất",
    "Rủi ro",
    "Theo dõi",
    "Nguồn tham khảo",
)
_QUICK_REPLIES = (
    "Xem quy trình bón phân cho lúa",
    "Kiểm tra thời tiết Điện Biên tuần này",
    "Xem danh sách đại lý vật tư",
    "Gọi cán bộ khuyến nông",
)


@dataclass(frozen=True)
class ChatSection:
    title: str
    content: list[str]


@dataclass(frozen=True)
class ChatCitation:
    evidence_id: str
    title: str
    source_url: str


@dataclass(frozen=True)
class ChatAnswer:
    intent: Intent
    sections: list[ChatSection]
    quick_replies: list[str]
    citations: list[ChatCitation]
    confidence: float


class AgriculturalChatAssistant:
    """Safe local MVP for agricultural chat.

    Retrieval is deterministic and limited to the reviewed disease catalog. No
    ungrounded chemical advice is generated; an unknown query is escalated.
    """

    def __init__(self, knowledge: DiseaseKnowledgeRepository | None = None) -> None:
        self.knowledge = knowledge or DiseaseKnowledgeRepository()
        self.retriever = AgriculturalKnowledgeRetriever(self.knowledge)

    @staticmethod
    def build_context(history: list[tuple[str, str]]) -> list[tuple[str, str]]:
        return history[-10:]

    def answer(self, question: str, history: list[tuple[str, str]]) -> ChatAnswer:
        intent = self._classify(question)
        if intent == "out_of_scope":
            return self._out_of_scope()
        if intent == "weather":
            return self._weather_fallback()
        disease_match = self._match_disease(question)
        if disease_match is None:
            return self._needs_more_information()
        crop, disease, score = disease_match
        evidence = self.retriever.retrieve(crop.crop, disease.name, question)
        confidence = round(min(0.95, 0.45 + score * 0.35 + evidence.support_score * 0.2), 2)
        return self._disease_answer(crop.crop, disease, evidence.evidence, confidence)

    @staticmethod
    def _classify(question: str) -> Intent:
        value = normalize_text(question)
        if any(token in value for token in ("thoi tiet", "mua", "nhiet do", "suong muoi")):
            return "weather"
        if any(token in value for token in ("lua", "cay", "benh", "la ", "thuoc", "phan", "ruong")):
            return "disease"
        if any(token in value for token in ("bon phan", "gieo", "cham soc", "vietgap")):
            return "technique"
        return "out_of_scope"

    def _match_disease(self, question: str) -> tuple[CropProfile, DiseaseProfile, float] | None:
        best: tuple[CropProfile, DiseaseProfile, float] | None = None
        for crop in self.knowledge.crops:
            for disease in crop.diseases:
                score = self.knowledge.symptom_match_score(disease, question)
                name_tokens = normalize_text(f"{crop.crop} {disease.name} {' '.join(disease.aliases)}")
                if any(token in normalize_text(question) for token in name_tokens.split() if len(token) > 3):
                    score = max(score, 0.35)
                if best is None or score > best[2]:
                    best = (crop, disease, score)
        return best if best and best[2] > 0 else None

    def _disease_answer(
        self,
        crop_name: str,
        disease: DiseaseProfile,
        evidence: list[KnowledgeEvidence],
        confidence: float,
    ) -> ChatAnswer:
        by_section: dict[str, list[str]] = {}
        for item in evidence:
            by_section.setdefault(item.section, []).append(item.content)
        treatment = disease.biological_treatment or disease.ipm_treatment or [
            "Tạm dừng xử lý hóa học cho đến khi cán bộ kỹ thuật xác nhận."
        ]
        product = [
            "Ưu tiên biện pháp sinh học/IPM; chưa khuyến nghị tên thuốc hoặc liều lượng khi chưa xác định đủ điều kiện ruộng.",
            "Không trộn hóa chất và không dùng hoạt chất ngoài danh mục được phép.",
        ]
        sections = [
            ChatSection(_SECTION_NAMES[0], [f"Có dấu hiệu phù hợp với {disease.name} trên {crop_name}."]),
            ChatSection(_SECTION_NAMES[1], by_section.get("cause", disease.favorable_conditions[:2] or ["Cần thêm ảnh và thông tin ruộng để xác định nguyên nhân."])),
            ChatSection(_SECTION_NAMES[2], [f"{confidence:.0%} — cần đối chiếu tại ruộng trước khi dùng thuốc."]),
            ChatSection(_SECTION_NAMES[3], by_section.get("symptoms", disease.symptoms[:3])),
            ChatSection(_SECTION_NAMES[4], disease.follow_up_questions[:3] or ["Chụp cận cảnh cả mặt trên và mặt dưới lá, ghi rõ tuổi cây và vị trí ruộng."]),
            ChatSection(_SECTION_NAMES[5], treatment[:4]),
            ChatSection(_SECTION_NAMES[6], product),
            ChatSection(_SECTION_NAMES[7], disease.do_not[:3] or ["Bệnh có thể lan rộng nếu xử lý sai hoặc chậm."]),
            ChatSection(_SECTION_NAMES[8], ["Kiểm tra lại sau 48–72 giờ và gửi ảnh mới nếu triệu chứng tăng."]),
            ChatSection(_SECTION_NAMES[9], [f"{item.title} — {item.source_url}" for item in evidence[:4]] or ["Chưa có nguồn phù hợp."]),
        ]
        return ChatAnswer(
            intent="disease",
            sections=sections,
            quick_replies=list(_QUICK_REPLIES),
            citations=[ChatCitation(item.evidence_id, item.title, item.source_url) for item in evidence[:4]],
            confidence=confidence,
        )

    @staticmethod
    def _out_of_scope() -> ChatAnswer:
        return ChatAnswer("out_of_scope", [ChatSection("Kết luận", ["Xin lỗi, tôi chưa có thông tin về vấn đề này. Bác có muốn kết nối với cán bộ không?"])], list(_QUICK_REPLIES), [], 0.0)

    @staticmethod
    def _weather_fallback() -> ChatAnswer:
        return ChatAnswer("weather", [ChatSection("Kết luận", ["Tôi cần huyện/xã và khoảng thời gian cụ thể để tra thời tiết an toàn."])], list(_QUICK_REPLIES), [], 0.0)

    @staticmethod
    def _needs_more_information() -> ChatAnswer:
        return ChatAnswer("disease", [ChatSection("Kết luận", ["Chưa đủ dữ liệu để chẩn đoán. Hãy gửi ảnh rõ lá/thân, tên cây và tuổi cây."])], list(_QUICK_REPLIES), [], 0.0)
