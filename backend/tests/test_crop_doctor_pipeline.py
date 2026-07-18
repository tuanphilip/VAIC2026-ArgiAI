import unittest

from app.routes.diseases import _should_persist_analysis
from app.services.crop_doctor_tools import (
    CandidateAssessment,
    CropContext,
    ImageQualityResult,
    build_treatment,
    compute_final_score,
    review_gate,
)
from app.services.crop_doctor_triage import _merge_local_candidates
from app.services.agricultural_retriever import AgriculturalKnowledgeRetriever
from app.services.disease_detector import (
    DiseaseAnalysisResult,
    DiseaseCandidate,
    _build_openai_vision_payload,
    has_valid_diagnosis,
)
from app.services.disease_knowledge import DiseaseKnowledgeRepository
from app.services.weather_context import WeatherSnapshot, weather_support_score


class CropDoctorPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.knowledge = DiseaseKnowledgeRepository()

    def test_unavailable_result_is_not_a_diagnosis(self) -> None:
        result = DiseaseAnalysisResult(
            detected_disease="Chưa có kết quả chẩn đoán",
            confidence=0.0,
            severity="Không xác định",
            treatment_measures="",
            source="unavailable",
            diagnosis_mode="unavailable",
        )

        self.assertFalse(has_valid_diagnosis(result))

    def test_openai_compatible_vision_payload_contains_image_and_closed_set(self) -> None:
        payload = _build_openai_vision_payload(
            model="gemini-2.5-flash",
            base64_image="YWJj",
            mime_type="image/jpeg",
            expected_crop="Lúa",
        )

        self.assertEqual(payload["model"], "gemini-2.5-flash")
        content = payload["messages"][0]["content"]
        self.assertIn("Đạo ôn", content[0]["text"])
        self.assertIn("Không đề xuất thuốc", content[0]["text"])
        self.assertEqual(
            content[1]["image_url"]["url"],
            "data:image/jpeg;base64,YWJj",
        )

    def test_local_symptom_triage_prioritizes_coffee_rust(self) -> None:
        crop = self.knowledge.find_crop("Cà phê")
        self.assertIsNotNone(crop)

        candidates = _merge_local_candidates(
            [],
            crop,
            "Lá có đốm vàng, mặt dưới có bột màu cam và lá rụng sớm.",
            self.knowledge,
        )

        self.assertTrue(candidates)
        self.assertEqual(candidates[0].disease, "Gỉ sắt cà phê")
        self.assertLessEqual(candidates[0].confidence, 0.65)

    def test_symptom_triage_final_score_is_capped(self) -> None:
        result = DiseaseAnalysisResult(
            detected_disease="Gỉ sắt cà phê",
            confidence=0.9,
            severity="Cao",
            treatment_measures="",
            source="symptom_triage_agent",
            diagnosis_mode="symptom_triage",
        )

        score = compute_final_score(
            result,
            ImageQualityResult(is_valid=True, quality_score=1.0),
            best_assessment=None,
            crop_match_score=1.0,
        )

        self.assertEqual(score, 0.65)
        self.assertFalse(_should_persist_analysis(result))

    def test_unavailable_review_does_not_emit_cascading_score_warnings(self) -> None:
        result = DiseaseAnalysisResult(
            detected_disease="Chưa có kết quả chẩn đoán",
            confidence=0.0,
            severity="Không xác định",
            treatment_measures="",
            source="unavailable",
            diagnosis_mode="unavailable",
            warnings=["Dịch vụ phân tích nội dung ảnh hiện chưa sẵn sàng."],
        )

        needs_review, warnings = review_gate(
            result,
            ImageQualityResult(is_valid=True, quality_score=1.0),
            final_score=0.0,
            crop_match_score=0.0,
            best_assessment=None,
            assessed_candidates=[],
        )

        self.assertTrue(needs_review)
        self.assertNotIn("Điểm tin cậy tổng hợp dưới ngưỡng tự động kết luận.", warnings)
        self.assertNotIn("Bệnh nghi ngờ chưa nằm trong knowledge base MVP cho cây trồng này.", warnings)
        self.assertLessEqual(len(warnings), 2)

    def test_winter_vegetable_catalog_has_structured_profiles(self) -> None:
        crop = self.knowledge.find_crop("Rau vụ đông")
        disease = self.knowledge.find_disease("Rau vụ đông", "sương mai")

        self.assertEqual(self.knowledge.version, "2026.07.1")
        self.assertIsNotNone(crop)
        self.assertIsNotNone(disease)
        assert disease is not None
        self.assertEqual(disease.disease_id, "brassica-downy-mildew")
        self.assertTrue(disease.cause)
        self.assertTrue(disease.prevention)
        self.assertTrue(disease.follow_up_questions)

    def test_retriever_returns_stable_diverse_evidence(self) -> None:
        retriever = AgriculturalKnowledgeRetriever(self.knowledge)
        first = retriever.retrieve(
            "Cà phê",
            "Gỉ sắt cà phê",
            "đốm vàng và bột cam mặt dưới lá",
        )
        second = retriever.retrieve(
            "Cà phê",
            "Gỉ sắt cà phê",
            "đốm vàng và bột cam mặt dưới lá",
        )

        self.assertGreaterEqual(first.support_score, 0.8)
        self.assertEqual(
            [item.evidence_id for item in first.evidence],
            [item.evidence_id for item in second.evidence],
        )
        self.assertIn("symptoms", {item.section for item in first.evidence})
        self.assertIn("prevention", {item.section for item in first.evidence})
        self.assertTrue(all(item.source_url for item in first.evidence))

    def test_review_required_treatment_excludes_chemical_advice(self) -> None:
        disease = self.knowledge.find_disease("Lúa", "Đạo ôn lúa")
        assert disease is not None
        analysis = DiseaseAnalysisResult(
            detected_disease=disease.name,
            confidence=0.75,
            severity=disease.severity_default,
            treatment_measures="",
            crop="Lúa",
            source="gemini",
        )
        assessment = CandidateAssessment(
            candidate=DiseaseCandidate(disease=disease.name, confidence=0.75),
            disease_profile=disease,
            symptom_match_score=0.5,
            sources=disease.sources,
        )

        treatment = build_treatment(
            analysis,
            assessment,
            needs_human_review=True,
            allow_chemical=False,
        )

        self.assertNotIn("Biện pháp hóa học có điều kiện", treatment)
        self.assertNotIn("tricyclazole", treatment.lower())
        self.assertIn("cần cán bộ kỹ thuật xác nhận", treatment.lower())

    def test_weather_is_only_a_small_confidence_modifier(self) -> None:
        disease = self.knowledge.find_disease("Lúa", "Đạo ôn lúa")
        assert disease is not None
        snapshot = WeatherSnapshot(
            provider="test",
            observed_at="2026-07-18T00:00:00Z",
            average_temperature_c=24,
            minimum_temperature_c=21,
            maximum_temperature_c=27,
            average_relative_humidity=95,
            rainfall_72h_mm=12,
            summary="test",
        )
        support = weather_support_score(disease, snapshot)
        self.assertEqual(support, 1.0)

        analysis = DiseaseAnalysisResult(
            detected_disease=disease.name,
            confidence=0.9,
            severity=disease.severity_default,
            treatment_measures="",
            crop="Lúa",
            source="gemini",
            top_candidates=[DiseaseCandidate(disease=disease.name, confidence=0.9)],
        )
        assessment = CandidateAssessment(
            candidate=analysis.top_candidates[0],
            disease_profile=disease,
            symptom_match_score=0.8,
            sources=disease.sources,
        )
        without_weather = compute_final_score(
            analysis,
            ImageQualityResult(is_valid=True, quality_score=1.0),
            assessment,
            crop_match_score=1.0,
            knowledge_support=1.0,
        )
        with_weather = compute_final_score(
            analysis,
            ImageQualityResult(is_valid=True, quality_score=1.0),
            assessment,
            crop_match_score=1.0,
            knowledge_support=1.0,
            weather_support=support,
        )

        self.assertLessEqual(abs(with_weather - without_weather), 0.05)


if __name__ == "__main__":
    unittest.main()
