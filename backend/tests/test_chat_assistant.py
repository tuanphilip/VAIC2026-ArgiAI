import unittest

from app.services.chat_assistant import AgriculturalChatAssistant


class AgriculturalChatAssistantTests(unittest.TestCase):
    def setUp(self) -> None:
        self.assistant = AgriculturalChatAssistant()

    def test_disease_answer_has_ten_sections_and_quick_replies(self) -> None:
        answer = self.assistant.answer("Lúa bị cháy đầu lá, vàng lá thì xử lý gì?", history=[])

        self.assertEqual(answer.intent, "disease")
        self.assertEqual(len(answer.sections), 10)
        self.assertEqual(len(answer.quick_replies), 4)
        self.assertTrue(answer.citations)
        self.assertNotIn("thuốc cấm", " ".join(answer.sections[6].content).lower())

    def test_unknown_question_does_not_hallucinate(self) -> None:
        answer = self.assistant.answer("Giúp tôi chọn điện thoại chơi game", history=[])

        self.assertEqual(answer.intent, "out_of_scope")
        self.assertIn("chưa có thông tin", answer.sections[0].content[0].lower())
        self.assertEqual(answer.quick_replies[-1], "Gọi cán bộ khuyến nông")

    def test_history_is_limited_to_ten_turns(self) -> None:
        history = [("user", f"lượt {index}") for index in range(20)]

        context = self.assistant.build_context(history)

        self.assertEqual(len(context), 10)
        self.assertEqual(context[0][1], "lượt 10")
        self.assertEqual(context[-1][1], "lượt 19")


if __name__ == "__main__":
    unittest.main()
